function capcase(string) {
  string = cleanChars(string);
  return string
    .replace(/\W+/g, "_")
    .split("_")
    .map(item => item[0].toUpperCase() + item.slice(1))
    .join("_");
}

function underscore(string) {
  string = cleanChars(string);
  return string
    .toLowerCase()
    .split(" ")
    .join("_");
}

function dash(string) {
  string = cleanChars(string);
  return string
    .toLowerCase()
    .split(" ")
    .join("-");
}

function cleanChars(string) {
  return string
    .replace(/(å|ä)/g, "a")
    .replace(/(Å|Ä)/g, "A")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O");
}

function prefix(string) {
  let prefix = "";
  const projectNameWords = string.split(" ");

  if (projectNameWords && projectNameWords.length >= 2) {
    for (const word of projectNameWords) {
      prefix += word.charAt(0).toUpperCase();
    }
  }

  // 2. If project has only 1 word, use the first 3 letters of project name
  if (prefix.length < 2 && string.length > 2) {
    prefix = `${string.charAt(0)}${string.charAt(1)}${string.charAt(
      2
    )}`.toUpperCase();
  }

  return cleanChars(prefix);
}

module.exports = {
  capcase,
  underscore,
  dash,
  prefix
};
