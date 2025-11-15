// Vitest setup file
// This runs before all tests

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

// Mock document if needed for DOM tests
if (typeof document === 'undefined') {
  global.document = {
    createElement: (tag) => ({
      textContent: '',
      innerHTML: ''
    })
  };
}
