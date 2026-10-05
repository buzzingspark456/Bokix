// Listor (bloggen, nyheterna) visar små kort: lätta WebP-miniatyrer i
// public/blog/thumb (800 px, ~15 kB) i stället för de fulla 2400 px-bilderna
// (~200 kB styck). Originalen används kvar på själva artikeln och i
// delningsförhandsvisningar. Ny bild? Gör miniatyren med samma namn:
//   ffmpeg -i public/blog/x.jpg -vf "scale='min(800,iw)':-2" -c:v libwebp -quality 80 public/blog/thumb/x.webp
export const blogThumb = (src) => src.replace(/^\/blog\/(.+)\.jpg$/, '/blog/thumb/$1.webp');
