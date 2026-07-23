export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  return password.length >= 6;
}

export function validateRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}