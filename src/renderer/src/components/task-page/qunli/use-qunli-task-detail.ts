import { useEffect, useState } from 'react'
import type { QunliComment, QunliTaskDetail } from '../../../../../shared/qunli/qunli-types'
import { qunliGetTask, qunliTaskComments } from '@/runtime/qunli/runtime-qunli-client'
import { defaultScopeSource } from '@/runtime/hosts/selection/default-creation-host'
import { useAppStore } from '@/store'

export function useQunliTaskDetail(ref: string | null) {
  const settings = useAppStore((s) => s.settings)
  const [detail, setDetail] = useState<QunliTaskDetail | null>(null)
  const [comments, setComments] = useState<QunliComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setComments([])
    setError(null)
    if (!ref) {
      return
    }
    let cancelled = false
    const source = defaultScopeSource(settings)
    setLoading(true)
    Promise.all([qunliGetTask(source, ref), qunliTaskComments(source, ref)])
      .then(([nextDetail, nextComments]) => {
        if (!cancelled) {
          setDetail(nextDetail)
          setComments(nextComments)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [ref, settings])

  return { detail, setDetail, comments, loading, error }
}
