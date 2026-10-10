export async function listSubscriptionCustomerIds(stripe, userId, knownCustomerIds = []) {
  const customerIds = new Set(knownCustomerIds.filter(Boolean));
  const query = `metadata['user_id']:'${userId}'`;
  let page = await stripe.subscriptions.search({ query, limit: 100 });

  while (true) {
    for (const subscription of page.data) {
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
      if (customerId) customerIds.add(customerId);
    }
    if (!page.has_more) break;
    if (!page.next_page) throw new Error('Stripe returned an incomplete subscription page.');
    page = await stripe.subscriptions.search({ query, limit: 100, page: page.next_page });
  }

  return [...customerIds];
}

export async function listSubscriptionInvoices(stripe, customerIds) {
  const invoices = [];
  const seen = new Set();

  for (const customerId of new Set(customerIds.filter(Boolean))) {
    let page = await stripe.invoices.list({ customer: customerId, limit: 100 });
    while (true) {
      for (const invoice of page.data) {
        if (seen.has(invoice.id)) continue;
        seen.add(invoice.id);
        invoices.push({
          id: invoice.id,
          number: invoice.number || null,
          created: invoice.created,
          status: invoice.status || 'unknown',
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          hosted_invoice_url: invoice.hosted_invoice_url || null,
          invoice_pdf: invoice.invoice_pdf || null,
        });
      }
      if (!page.has_more) break;
      const lastInvoice = page.data[page.data.length - 1];
      if (!lastInvoice?.id) throw new Error('Stripe returned an incomplete invoice page.');
      page = await stripe.invoices.list({
        customer: customerId,
        limit: 100,
        starting_after: lastInvoice.id,
      });
    }
  }

  return invoices.sort((a, b) => b.created - a.created);
}
