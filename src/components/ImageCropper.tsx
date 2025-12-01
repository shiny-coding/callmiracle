'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Slider, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { useTranslations } from 'next-intl'

interface ImageCropperProps {
  open: boolean
  imageFile: File
  onClose: () => void
  onApply: (croppedFile: File) => void
}

export default function ImageCropper({ open, imageFile, onClose, onApply }: ImageCropperProps) {
  const t = useTranslations()
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState(280)
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null)
  const [initialPinchScale, setInitialPinchScale] = useState(1)

  const minScale = useMemo(() =>
    Math.min(containerSize / imageSize.width, containerSize / imageSize.height) * 0.5 || 0.1
  , [containerSize, imageSize.width, imageSize.height])

  const maxScale = useMemo(() =>
    Math.max(minScale * 5, 3)
  , [minScale])

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return

    const url = URL.createObjectURL(imageFile)
    setImageSrc(url)

    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
      // Calculate initial scale to fit the circle
      const minDim = Math.min(img.width, img.height)
      const initialScale = containerSize / minDim
      setScale(initialScale)
      // Center the image
      setPosition({
        x: (containerSize - img.width * initialScale) / 2,
        y: (containerSize - img.height * initialScale) / 2
      })
    }
    img.src = url

    return () => URL.revokeObjectURL(url)
  }, [imageFile, containerSize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
    } else if (e.touches.length === 2) {
      // Start pinch zoom
      setIsDragging(false)
      const distance = getDistance(e.touches[0], e.touches[1])
      setInitialPinchDistance(distance)
      setInitialPinchScale(scale)
    }
  }, [position, scale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      // Pinch zoom
      const currentDistance = getDistance(e.touches[0], e.touches[1])
      const scaleRatio = currentDistance / initialPinchDistance
      const newScale = Math.max(
        Math.min(initialPinchScale * scaleRatio, maxScale),
        minScale || 0.1
      )

      // Calculate pinch center
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const pinchX = centerX - rect.left
        const pinchY = centerY - rect.top

        // Adjust position to zoom towards pinch center
        const imgCenterX = position.x + (imageSize.width * scale) / 2
        const imgCenterY = position.y + (imageSize.height * scale) / 2
        const scaleChange = newScale / scale
        const newImgCenterX = pinchX + (imgCenterX - pinchX) * scaleChange
        const newImgCenterY = pinchY + (imgCenterY - pinchY) * scaleChange

        setPosition({
          x: newImgCenterX - (imageSize.width * newScale) / 2,
          y: newImgCenterY - (imageSize.height * newScale) / 2
        })
      }

      setScale(newScale)
    } else if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0]
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      })
    }
  }, [isDragging, dragStart, initialPinchDistance, initialPinchScale, scale, position, imageSize, minScale, maxScale])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    setInitialPinchDistance(null)
  }, [])

  const handleScaleChange = (_: Event, value: number | number[]) => {
    const newScale = value as number
    // Adjust position to zoom towards center
    const centerX = containerSize / 2
    const centerY = containerSize / 2
    const imgCenterX = position.x + (imageSize.width * scale) / 2
    const imgCenterY = position.y + (imageSize.height * scale) / 2

    const scaleRatio = newScale / scale
    const newImgCenterX = centerX + (imgCenterX - centerX) * scaleRatio
    const newImgCenterY = centerY + (imgCenterY - centerY) * scaleRatio

    setPosition({
      x: newImgCenterX - (imageSize.width * newScale) / 2,
      y: newImgCenterY - (imageSize.height * newScale) / 2
    })
    setScale(newScale)
  }

  const handleApply = useCallback(() => {
    const canvas = document.createElement('canvas')
    const size = 480 // Output size
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Calculate the crop region
      const scaleFactor = size / containerSize
      const drawX = position.x * scaleFactor
      const drawY = position.y * scaleFactor
      const drawWidth = imageSize.width * scale * scaleFactor
      const drawHeight = imageSize.height * scale * scaleFactor

      // Create circular clip
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()

      // Draw the image
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' })
          onApply(file)
        }
      }, 'image/jpeg', 0.9)
    }
    img.src = imageSrc
  }, [imageSrc, position, scale, imageSize, containerSize, onApply])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex justify-between items-center">
        <span className="text-color">{t('cropImage')}</span>
        <IconButton onClick={onClose} size="small" className="icon-gradient">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="flex flex-col items-center gap-4 py-4">
        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative overflow-hidden cursor-move"
          style={{
            width: containerSize,
            height: containerSize,
            borderRadius: '50%',
            border: '2px solid var(--icon-color-primary)',
            touchAction: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: imageSize.width * scale,
                height: imageSize.height * scale,
                maxWidth: 'none',
                pointerEvents: 'none'
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2 w-full max-w-[280px]">
          <ZoomOutIcon className="dimmer-text-color" />
          <Slider
            value={scale}
            onChange={handleScaleChange}
            min={minScale || 0.1}
            max={maxScale}
            step={0.01}
            sx={{
              '& .MuiSlider-thumb': {
                backgroundColor: 'var(--icon-color-primary)',
              },
              '& .MuiSlider-track': {
                backgroundColor: 'var(--icon-color-primary)',
              },
            }}
          />
          <ZoomInIcon className="dimmer-text-color" />
        </div>

        <Typography variant="body2" className="dimmer-text-color text-center">
          {t('dragToPosition')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          {t('cancel')}
        </Button>
        <Button onClick={handleApply} variant="contained" color="primary">
          {t('apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
