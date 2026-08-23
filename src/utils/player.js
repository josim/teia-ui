// Opening another curation replaces the current one

export function openPlayerPopup(path, name = 'teia-player') {
  return window.open(path, name, 'width=440,height=680,popup=yes')
}
