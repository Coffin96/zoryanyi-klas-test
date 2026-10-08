export function plural(n, forms) {
  let idx;
  if (n % 10 === 1 && n % 100 !== 11) {
    idx = 0; // 1, 21, 31...
  } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
    idx = 1; // 2-4, 22-24...
  } else {
    idx = 2; // 0, 5-9, 11-14...
  }
  return forms[idx];
}
