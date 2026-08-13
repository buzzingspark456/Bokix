const fs = require('fs');
const path = require('path');
const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') && f !== 'LandingPage.jsx' && f !== 'OnboardingFlow.jsx');
let changed = 0;
files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  const newContent = content.replace(/maxWidth:\s*'(680|700|720|800|900|1000|1100|1200)px'/g, "maxWidth: '100%'");
  if (content !== newContent) {
    fs.writeFileSync(p, newContent);
    changed++;
    console.log('Updated ' + f);
  }
});
console.log('Changed ' + changed + ' files.');
