export function formatName(name) {
  const lowerWords = ["da", "de", "do", "dos", "das", "e"];

  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index !== 0 && lowerWords.includes(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
