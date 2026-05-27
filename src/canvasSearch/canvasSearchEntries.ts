import { STUDY_SUBJECT_CATALOG } from '../components/study/studyHubData'
import { storedContentToHtml } from '../canvasItems/textEditorContent'
import type { CanvasItem, StudySubjectId } from '../canvasItems/types'

export type CanvasSearchKind = 'sticky' | 'text' | 'space' | 'study_hub'

export type CanvasSearchEntry = {
  id: string
  kind: CanvasSearchKind
  title: string
  preview: string
  searchText: string
  item: CanvasItem
  accentColor?: string
  studySubjectId?: StudySubjectId
}

function plainTextFromStored(stored: string): string {
  if (!stored.trim()) return ''
  const html = storedContentToHtml(stored)
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function buildStudyHubSearchText(subjectId: StudySubjectId): string {
  const catalog = STUDY_SUBJECT_CATALOG[subjectId]
  const parts = [catalog.paperCode, catalog.label, catalog.fullName, subjectId]
  for (const mod of catalog.modules) {
    parts.push(mod.name, ...mod.lectures)
  }
  return parts.join(' ').toLowerCase()
}

export function buildCanvasSearchEntries(items: CanvasItem[]): CanvasSearchEntry[] {
  const entries: CanvasSearchEntry[] = []

  for (const item of items) {
    if (item.type === 'sticky') {
      const plain = plainTextFromStored(item.text)
      const title = plain ? truncate(plain, 48) : 'Untitled sticky'
      entries.push({
        id: item.id,
        kind: 'sticky',
        title,
        preview: plain || 'Empty sticky note',
        searchText: plain.toLowerCase(),
        item,
      })
      continue
    }

    if (item.type === 'text') {
      const plain = plainTextFromStored(item.text)
      const title = plain ? truncate(plain, 48) : 'Untitled text'
      entries.push({
        id: item.id,
        kind: 'text',
        title,
        preview: plain || 'Empty text',
        searchText: plain.toLowerCase(),
        item,
      })
      continue
    }

    if (item.type === 'space') {
      const name = item.name.trim() || 'Untitled space'
      entries.push({
        id: item.id,
        kind: 'space',
        title: name,
        preview: name,
        searchText: name.toLowerCase(),
        item,
      })
      continue
    }

    if (item.type === 'study_hub') {
      const catalog = STUDY_SUBJECT_CATALOG[item.subjectId]
      entries.push({
        id: item.id,
        kind: 'study_hub',
        title: catalog.paperCode,
        preview: catalog.fullName,
        searchText: buildStudyHubSearchText(item.subjectId),
        item,
        studySubjectId: item.subjectId,
      })
    }
  }

  return entries.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
}

export function filterCanvasSearchEntries(
  entries: CanvasSearchEntry[],
  query: string,
): CanvasSearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const matched = entries.filter(
    (e) =>
      e.searchText.includes(q) ||
      e.title.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q),
  )

  return matched.sort((a, b) => {
    const aStudyHub = a.kind === 'study_hub' ? 0 : 1
    const bStudyHub = b.kind === 'study_hub' ? 0 : 1
    if (aStudyHub !== bStudyHub) return aStudyHub - bStudyHub
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  })
}
