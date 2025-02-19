export async function save(id: string, data: object) {
    chrome.storage.local.set({[id]: data})
}
export async function get(id?: string) {
    return await chrome.storage.local.get(id)
}