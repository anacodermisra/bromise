const fs = require('fs');

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : hex;
}

let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace(/#[0-9a-fA-F]{6}/g, match => hexToRgb(match));
fs.writeFileSync('src/index.css', css);

let tw = fs.readFileSync('tailwind.config.js', 'utf8');
tw = tw.replace(/'var\((--[a-z-]+)\)'/g, "'rgb(var($1) / <alpha-value>)'");
fs.writeFileSync('tailwind.config.js', tw);

console.log("Fixed!");
