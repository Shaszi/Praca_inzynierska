import { useEffect, useState } from 'react'
import { progressService, type ImageProject } from '../../../progress/services/progressService'
import { ImageProjectCard } from './ImageProjectCard'

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

  const remove = async (project: ImageProject) => {
    await progressService.deleteProject(project.id, project.photoPath)
    setProjects((list) => list.filter((item) => item.id !== project.id))
  }

  if (projects.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[15px] font-semibold text-ink-faint">Twoje projekty</h3>
      <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project) => (
          <ImageProjectCard
            key={project.id}
            project={project}
            onRename={(title) => rename(project.id, title)}
            onDelete={() => remove(project)}
          />
        ))}
      </ul>
    </section>
  )
}
