'use client'

import { Dialog, DialogTitle, DialogContent, IconButton, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import clientLogger, { type LogEntry } from '@/utils/clientLogger'

interface LogViewerDialogProps {
  open: boolean
  onClose: () => void
}

export default function LogViewerDialog({ open, onClose }: LogViewerDialogProps) {
  const t = useTranslations()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setLogs(clientLogger.getLogBuffer())
    }
  }, [open])

  const handleCopy = async () => {
    const formattedLogs = logs.map(log => {
      const metaStr = Object.keys(log.meta).length > 0 ? ` ${JSON.stringify(log.meta)}` : ''
      return `${log.timestamp} [${log.level.toUpperCase()}]: ${log.message}${metaStr}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(formattedLogs)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy logs:', err)
    }
  }

  const handleClear = () => {
    clientLogger.clearLogBuffer()
    setLogs([])
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-yellow-500'
      case 'info': return 'text-blue-500'
      case 'debug': return 'text-gray-500'
      default: return 'text-gray-300'
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      sx={{
        zIndex: 1500
      }}
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff'
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #333'
      }}>
        <span>Logs ({logs.length})</span>
        <div className="flex gap-2">
          <Button
            onClick={handleClear}
            startIcon={<DeleteIcon />}
            size="small"
            variant="outlined"
            color="error"
          >
            Clear
          </Button>
          <Button
            onClick={handleCopy}
            startIcon={<ContentCopyIcon />}
            size="small"
            variant="outlined"
            disabled={logs.length === 0}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <div className="font-mono text-xs p-4 overflow-auto h-full">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No logs yet</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 hover: px-2 py-1 rounded">
                <span className="text-gray-500">{log.timestamp}</span>
                {' '}
                <span className={getLevelColor(log.level)}>[{log.level.toUpperCase()}]</span>
                {': '}
                <span>{log.message}</span>
                {Object.keys(log.meta).length > 0 && (
                  <span className="text-gray-400"> {JSON.stringify(log.meta)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
