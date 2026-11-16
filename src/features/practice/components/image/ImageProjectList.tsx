import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StrokeThumbnail } from '../../../progress/components/StrokeThumbnail'
import { progressService, type ImageProject } from '../../../progress/services/progressService'
import { EditableTitle } from '../EditableTitle'

/**
 * „Twoje projekty” — rysunki ze zdjęć, także porzucone, z powrotem do projektu i zmianą nazwy.
 * Lista pobiera się sama przy pokazaniu: jest tylko na ekranie wgrywania, tam jej się szuka.
 */
export function ImageProjectList() {
  const [projects, setProjects] = useState<ImageProject[]>([])

  useEffect(() => {
    let cancelled = false
    progressService
      .listImageProjects()
      .then((list) => !cancelled && setProjects(list))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const rename = async (projectId: string, title: string) => {
    const saved = await progressService.renameProject(projectId, title)
    setProjects((list) => list.map((item) => (item.id === projectId ? { ...item, title: saved } : item)))
  }

  if (projects.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[15px] font-semibold text-ink-faint">Twoje projekty</h3>
      <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project) => (
          <li key={project.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3">
            <div className="grid aspect-[4/3] place-items-center rounded-[14px] bg-paper-dim">
              {project.strokes.length > 0 ? (
                <StrokeThumbnail strokes={project.strokes} className="h-[80%] w-[80%]" />
              ) : (
                <span className="text-xs text-ink-faint">jeszcze pusty</span>
              )}
            </div>
            <EditableTitle title={project.title} onRename={(title) => rename(project.id, title)} />
            <small className="text-[12.5px] text-ink-faint">
              {project.isDone ? 'Ukończony' : `Krok ${project.stepIndex + 1} z ${project.stepsTotal}`}
            </small>
            <Link
              to={`/app/practice/image?session=${project.id}`}
              className="mt-auto inline-flex min-h-9 items-center justify-center rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
            >
              {project.isDone ? 'Otwórz' : 'Wróć do projektu'}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
