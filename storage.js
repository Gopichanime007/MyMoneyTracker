function getData(key, defaultVal = []) {
  return JSON.parse(localStorage.getItem(key)) || defaultVal;
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

