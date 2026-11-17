// Godown / depot dropdown order used across the project: Banari first, everything else A-Z.
export function sortDepotsBanariFirst<T extends { depot_name?: string | null }>(depots: T[] | null | undefined): T[] {
  const isBanari = (d: T) => (d.depot_name || "").trim().toLowerCase() === "banari"
  return [...(depots || [])].sort((a, b) => {
    const aB = isBanari(a)
    const bB = isBanari(b)
    if (aB && !bB) return -1
    if (!aB && bB) return 1
    return (a.depot_name || "").localeCompare(b.depot_name || "")
  })
}

// Same rule for plain name strings (e.g. a user's depo_access list).
export function sortNamesBanariFirst(names: string[] | null | undefined): string[] {
  return sortDepotsBanariFirst((names || []).map((n) => ({ depot_name: n }))).map((d) => d.depot_name as string)
}

// Same rule for objects whose name lives under another key (e.g. dashboard { id, name }).
export function sortByNameBanariFirst<T>(items: T[] | null | undefined, getName: (item: T) => string | null | undefined): T[] {
  const isBanari = (i: T) => (getName(i) || "").trim().toLowerCase() === "banari"
  return [...(items || [])].sort((a, b) => {
    const aB = isBanari(a)
    const bB = isBanari(b)
    if (aB && !bB) return -1
    if (!aB && bB) return 1
    return (getName(a) || "").localeCompare(getName(b) || "")
  })
}
