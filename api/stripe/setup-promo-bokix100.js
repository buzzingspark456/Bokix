// ── TILLFÄLLIG engångsendpoint — skapar Stripe-kupongen/kampanjkoden
// BOKIX100 (100% rabatt, för alltid) om den inte redan finns. Skyddad av
// ADMIN_SETUP_SECRET (satt direkt i Vercel, aldrig i kod) så bara ett
// avsiktligt anrop med rätt hemlighet kan köra den. Tas bort ur repot igen
// direkt efter att den körts en gång — ska INTE bli en permanent, allmänt
// nåbar administrationsväg. ──
import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {})
  : null;

const PROMO_CODE = 'BOKIX100';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SETUP_SECRET || providedSecret !== process.env.ADMIN_SETUP_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    // Idempotent: kör man den av misstag igen (eller Stripe levererar
    // samma anrop två gånger) skapas aldrig en andra kupong/kod.
    const existing = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 });
    if (existing.data.length > 0) {
      res.status(200).json({ status: 'already_exists', promotion_code: existing.data[0].id });
      return;
    }

    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'forever',
      name: 'Bokix 100% — kampanjkod',
    });

    const promotionCode = await stripe.promotionCodes.create({
      code: PROMO_CODE,
      coupon: coupon.id,
    });

    res.status(200).json({ status: 'created', coupon_id: coupon.id, promotion_code: promotionCode.id });
  } catch (error) {
    console.error('setup-promo-bokix100 error:', error);
    res.status(500).json({ error: error.message || 'Failed to create promo code' });
  }
}
