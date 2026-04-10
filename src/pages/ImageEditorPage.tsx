import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JSZip from 'jszip'
import { useAppStore } from '../store/appStore'
import { usePageHeader } from '../components/layout/PageHeaderContext'
import { downloadImage } from '@/utils/helpers'
import EditorCanvasStage from '@/components/image-editor/EditorCanvasStage'
import {
  buildImageEditRequest,
  selectionToNaturalRect,
  type DisplayLayout,
  type Rect
} from '@/features/image-editor/geometry'
import { requestImageEdit } from '@/services/image-edit'

type SliceResult = { blob: Blob; name: string; url: string }
type EditorTab = 'slice' | 'edit'
type ImageSize = { width: number; height: number }

const SLICE_PRESETS = [
  { label: '2x2', rows: 2, cols: 2 },
  { label: '3x3', rows: 3, cols: 3 },
  { label: '4x4', rows: 4, cols: 4 },
  { label: '6x4', rows: 6, cols: 4 }
]

export default function ImageEditorPage() {
  const navigate = useNavigate()
  const {
    editorImageUrl,
    editorInitialTab,
    closeImageEditor,
    showToast,
    createSession,
    saveMessage,
    updateSessionTitle,
    loadSessions,
    bumpGalleryRefreshKey,
    getActiveConfig,
    resolution,
    aspectRatio
  } = useAppStore()
  const { setHeader } = usePageHeader()

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<EditorTab>('slice')
  const [rows, setRows] = useState(6)
  const [cols, setCols] = useState(4)
  const [rowGuides, setRowGuides] = useState<number[]>([])
  const [colGuides, setColGuides] = useState<number[]>([])
  const [forceSquare, setForceSquare] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [slices, setSlices] = useState<SliceResult[]>([])
  const [processingSlices, setProcessingSlices] = useState(false)
  const [naturalSize, setNaturalSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 0
  })
  const [selection, setSelection] = useState<Rect | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editing, setEditing] = useState(false)
  const [editResult, setEditResult] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const slicesRef = useRef<SliceResult[]>([])

  useEffect(() => {
    slicesRef.current = slices
  }, [slices])

  const clearSlices = useCallback(() => {
    setSlices(prev => {
      prev.forEach(item => URL.revokeObjectURL(item.url))
      return []
    })
  }, [])

  const applyGrid = useCallback((nextRows: number, nextCols: number) => {
    setRows(nextRows)
    setCols(nextCols)
    setRowGuides(Array.from({ length: Math.max(0, nextRows - 1) }, (_, index) => (index + 1) / nextRows))
    setColGuides(Array.from({ length: Math.max(0, nextCols - 1) }, (_, index) => (index + 1) / nextCols))
  }, [])

  const resetWorkingState = useCallback((nextTab?: EditorTab) => {
    clearSlices()
    setSelection(null)
    setEditPrompt('')
    setEditResult(null)
    setForceSquare(false)
    setBgColor('#ffffff')
    applyGrid(6, 4)
    if (nextTab) {
      setActiveTab(nextTab)
    }
  }, [applyGrid, clearSlices])

  useEffect(() => {
    if (editorImageUrl) {
      setImageSrc(editorImageUrl)
      resetWorkingState(editorInitialTab)
      return
    }
    setActiveTab(editorInitialTab)
  }, [editorImageUrl, editorInitialTab, resetWorkingState])

  useEffect(() => {
    return () => {
      slicesRef.current.forEach(item => URL.revokeObjectURL(item.url))
    }
  }, [])

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setImageSrc(event.target?.result as string)
      resetWorkingState(activeTab)
    }
    reader.readAsDataURL(files[0])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const selectionSummary = useMemo(() => {
    if (!selection || !naturalSize.width || !naturalSize.height) return null
    const rect = selectionToNaturalRect(selection, displayLayout, naturalSize)
    return rect.width > 0 && rect.height > 0 ? rect : null
  }, [displayLayout, naturalSize, selection])

  const processSlices = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height) return

    setProcessingSlices(true)
    clearSlices()
    try {
      const rowCuts = [0, ...rowGuides, 1].sort((a, b) => a - b)
      const colCuts = [0, ...colGuides, 1].sort((a, b) => a - b)
      const img = await loadImage(imageSrc)
      const nextSlices: SliceResult[] = []

      for (let rowIndex = 0; rowIndex < rowCuts.length - 1; rowIndex++) {
        for (let colIndex = 0; colIndex < colCuts.length - 1; colIndex++) {
          const srcX = Math.round(colCuts[colIndex] * naturalSize.width)
          const srcY = Math.round(rowCuts[rowIndex] * naturalSize.height)
          const srcW = Math.round((colCuts[colIndex + 1] - colCuts[colIndex]) * naturalSize.width)
          const srcH = Math.round((rowCuts[rowIndex + 1] - rowCuts[rowIndex]) * naturalSize.height)
          if (srcW <= 0 || srcH <= 0) continue

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          const scale = 2

          if (forceSquare) {
            const maxDim = Math.max(srcW, srcH)
            canvas.width = maxDim * scale
            canvas.height = maxDim * scale
            ctx.fillStyle = bgColor
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            const offsetX = ((maxDim - srcW) / 2) * scale
            const offsetY = ((maxDim - srcH) / 2) * scale
            ctx.drawImage(img, srcX, srcY, srcW, srcH, offsetX, offsetY, srcW * scale, srcH * scale)
          } else {
            canvas.width = srcW * scale
            canvas.height = srcH * scale
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW * scale, srcH * scale)
          }

          const blob = await canvasToBlob(canvas)
          const url = URL.createObjectURL(blob)
          nextSlices.push({
            blob,
            url,
            name: `slice_${rowIndex + 1}_${colIndex + 1}.png`
          })
        }
      }

      setSlices(nextSlices)
      showToast(`成功生成 ${nextSlices.length} 个切片`, 'success')
    } catch (error) {
      console.error('slice process failed', error)
      showToast('切片生成失败', 'error')
    } finally {
      setProcessingSlices(false)
    }
  }

  const handleSubmitEdit = async () => {
    if (!imageSrc || !selectionSummary) {
      showToast('请先框选需要修改的区域', 'warning')
      return
    }
    if (!editPrompt.trim()) {
      showToast('请填写修改需求', 'warning')
      return
    }

    const config = getActiveConfig('image')
    if (!config) {
      showToast('请先在设置中添加 API 渠道', 'warning')
      return
    }
    if (!config.imageModel) {
      showToast('请先在设置中填写绘图模型', 'warning')
      return
    }

    setEditing(true)
    try {
      const request = buildImageEditRequest({
        imageDataUrl: imageSrc,
        prompt: editPrompt,
        naturalSize,
        displayLayout,
        selection: selection!,
        // 已停用：不再把框选区域单独裁切后发送到 API。
        // const selectionImageDataUrl = await cropSelectionToDataUrl(imageSrc, selectionSummary)
        // selectionImageDataUrl,
        resolution,
        aspectRatio,
        enableModelSuffix: config.enableModelSuffix ?? true
      })

      const result = await requestImageEdit(config, request)
      setEditResult(result)
      await persistEditResult({
        prompt: editPrompt,
        sourceImage: imageSrc,
        resultImage: result,
        selectionRect: request.selectionRect
      })
      showToast('局部编辑完成，已保存为新作品', 'success')
    } catch (error) {
      console.error('image edit failed', error)
      showToast(error instanceof Error ? error.message : '局部编辑失败', 'error', 3000)
    } finally {
      setEditing(false)
    }
  }

  const persistEditResult = async ({
    prompt,
    sourceImage,
    resultImage,
    selectionRect
  }: {
    prompt: string
    sourceImage: string
    resultImage: string
    selectionRect: Rect
  }) => {
    const sessionId = await createSession('局部编辑')
    const plainSource = sourceImage.split(',')[1] || ''
    const plainResult = resultImage.split(',')[1] || ''
    const trimmedPrompt = prompt.trim()
    const selectionDescription = `局部编辑\n选区: x=${selectionRect.x}, y=${selectionRect.y}, w=${selectionRect.width}, h=${selectionRect.height}\n需求: ${trimmedPrompt}`

    await saveMessage(
      sessionId,
      'user',
      selectionDescription,
      plainSource ? [plainSource] : [],
      `<div class="msg-content">${selectionDescription.replace(/\n/g, '<br>')}</div>`
    )

    await saveMessage(
      sessionId,
      'bot',
      'Image Edited',
      plainResult ? [plainResult] : [],
      createEditorResultHtml(resultImage)
    )

    const title = trimmedPrompt.slice(0, 20) + (trimmedPrompt.length > 20 ? '...' : '')
    if (title) {
      await updateSessionTitle(sessionId, title)
    }
    await loadSessions()
    bumpGalleryRefreshKey()
  }

  const downloadSlice = (slice: SliceResult) => {
    const a = document.createElement('a')
    a.href = slice.url
    a.download = slice.name
    a.click()
  }

  const downloadAll = async () => {
    if (slices.length === 0) return
    const zip = new JSZip()
    const folder = zip.folder('slices')
    if (!folder) return
    slices.forEach(slice => folder.file(slice.name, slice.blob))
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `slices_${Date.now()}.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = useCallback(() => {
    setImageSrc(null)
    closeImageEditor()
    resetWorkingState(activeTab)
  }, [activeTab, closeImageEditor, resetWorkingState])

  const headerActions = useMemo(() => (
    <>
      <button
        onClick={() => navigate(-1)}
        className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm shadow-sm hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        返回
      </button>
      <button
        onClick={handleClear}
        className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-sm shadow-sm hover:opacity-80 transition-opacity"
      >
        清空
      </button>
    </>
  ), [handleClear, navigate])

  const handleStageMetricsChange = useCallback((metrics: { naturalSize: ImageSize; displayLayout: DisplayLayout }) => {
    setNaturalSize(metrics.naturalSize)
    setDisplayLayout(metrics.displayLayout)
  }, [])

  useEffect(() => {
    setHeader({
      title: '图片编辑',
      description: '生成切片 / 局部编辑',
      actions: headerActions
    })
    return () => setHeader(null)
  }, [headerActions, setHeader])

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full max-w-7xl mx-auto p-4 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4 lg:hidden">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">图片编辑</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 font-serif">生成切片 / 局部编辑</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm shadow-sm hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              返回
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-sm shadow-sm hover:opacity-80 transition-opacity"
            >
              清空
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-sm">
          <div className="flex flex-col xl:flex-row h-full">
            <div className="xl:w-[68%] p-4 border-b xl:border-b-0 xl:border-r border-[var(--border-color)] flex flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 text-sm bg-[var(--accent-color)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                >
                  选择图片
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />

                <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-xl p-1 border border-[var(--border-color)] shadow-sm">
                  <TabButton active={activeTab === 'slice'} label="生成切片" onClick={() => setActiveTab('slice')} />
                  <TabButton active={activeTab === 'edit'} label="局部编辑" onClick={() => setActiveTab('edit')} />
                </div>

                {activeTab === 'slice' && (
                  <>
                    {SLICE_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyGrid(preset.rows, preset.cols)}
                        className="px-2.5 py-1.5 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      onClick={processSlices}
                      disabled={!imageSrc || processingSlices}
                      className="px-3 py-2 text-sm bg-[var(--success-color)] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                    >
                      {processingSlices ? '处理中...' : '生成切片'}
                    </button>
                  </>
                )}
              </div>

              {activeTab === 'slice' ? (
                <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                  <label className="flex items-center gap-2">
                    行数
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={rows}
                      onChange={(e) => applyGrid(Math.max(1, Number(e.target.value) || 1), cols)}
                      className="w-20 px-2 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    列数
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={cols}
                      onChange={(e) => applyGrid(rows, Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-2 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]"
                    />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceSquare}
                      onChange={(e) => setForceSquare(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    强制正方形
                  </label>
                  {forceSquare && (
                    <label className="flex items-center gap-2">
                      背景色
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                    </label>
                  )}
                  <div className="text-xs text-[var(--text-tertiary)]">
                    以网格为主，可直接拖动分割线微调
                  </div>
                </div>
              ) : (
                <div className="mb-4 text-xs text-[var(--text-tertiary)]">
                  在图片上拖拽一个矩形框，提交时会把原图、裁剪图、坐标和需求一起发送给 API
                </div>
              )}

              <div
                className="flex-1 relative bg-[var(--bg-secondary)] rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-sm"
              >
                {!imageSrc ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-tertiary)] cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>点击选择图片</p>
                  </div>
                ) : (
                  <EditorCanvasStage
                    imageSrc={imageSrc}
                    mode={activeTab}
                    rowGuides={rowGuides}
                    colGuides={colGuides}
                    selection={selection}
                    onSelectionChange={setSelection}
                    onRowGuidesChange={setRowGuides}
                    onColGuidesChange={setColGuides}
                    onMetricsChange={handleStageMetricsChange}
                  />
                )}
              </div>
            </div>

            <div className="xl:w-[32%] p-4 overflow-y-auto">
              {activeTab === 'slice' ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">切片结果</h3>
                    {slices.length > 0 && (
                      <button
                        onClick={downloadAll}
                        className="px-3 py-1.5 text-sm bg-[var(--link-color)] text-white rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                      >
                        下载全部
                      </button>
                    )}
                  </div>

                  {slices.length === 0 ? (
                    <div className="text-center py-10 text-[var(--text-tertiary)]">
                      {processingSlices ? '处理中...' : '设置网格后点击“生成切片”'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {slices.map(slice => (
                        <button
                          key={slice.url}
                          onClick={() => downloadSlice(slice)}
                          className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden cursor-pointer hover:ring-2 ring-[var(--link-color)] transition-shadow border border-[var(--border-color)] text-left"
                        >
                          <img src={slice.url} alt="" className="w-full aspect-square object-contain" />
                          <div className="p-2 text-xs text-center text-[var(--text-secondary)]">
                            {slice.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="font-medium">局部编辑</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">单矩形框选，提交后保存为新作品</p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
                      <div className="text-xs text-[var(--text-tertiary)] mb-2">框选信息</div>
                      {selectionSummary ? (
                        <div className="text-sm leading-6">
                          x={selectionSummary.x}, y={selectionSummary.y}
                          <br />
                          w={selectionSummary.width}, h={selectionSummary.height}
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--text-tertiary)]">请先在左侧拖拽框选区域</div>
                      )}
                    </div>

                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="描述你希望如何修改框选区域..."
                      className="w-full min-h-[140px] px-3 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] resize-none shadow-sm"
                    />

                    <button
                      type="button"
                      onClick={handleSubmitEdit}
                      disabled={editing || !selectionSummary || !editPrompt.trim()}
                      className="w-full px-4 py-3 rounded-2xl bg-[var(--accent-color)] text-white font-medium shadow-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                    >
                      {editing ? '提交中...' : '提交局部编辑'}
                    </button>

                    {editResult && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">编辑结果</div>
                          <button
                            type="button"
                            onClick={() => downloadImage(editResult, `edited_${Date.now()}.png`)}
                            className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                          >
                            下载
                          </button>
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                          <img src={editResult} alt="" className="w-full h-auto" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        active ? 'bg-[var(--bg-primary)] shadow-sm' : 'hover:bg-[var(--bg-secondary)]'
      }`}
    >
      {label}
    </button>
  )
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('blob 生成失败'))
        return
      }
      resolve(blob)
    }, 'image/png', 1)
  })
}

// 已停用：局部编辑不再把框选区域单独裁切后发送到 API。
// async function cropSelectionToDataUrl(imageSrc: string, selectionRect: Rect): Promise<string> {
//   const image = await loadImage(imageSrc)
//   const canvas = document.createElement('canvas')
//   canvas.width = selectionRect.width
//   canvas.height = selectionRect.height
//   const ctx = canvas.getContext('2d')
//   if (!ctx) {
//     throw new Error('无法创建裁剪画布')
//   }
//   ctx.drawImage(
//     image,
//     selectionRect.x,
//     selectionRect.y,
//     selectionRect.width,
//     selectionRect.height,
//     0,
//     0,
//     selectionRect.width,
//     selectionRect.height
//   )
//   return canvas.toDataURL('image/png', 1)
// }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = src
  })
}

function createEditorResultHtml(imageSrc: string) {
  return `
    <div class="msg-content" style="padding:0">
      <div class="img-result-group">
        <img class="generated-image" src="${imageSrc}" data-filename="edited_${Date.now()}.png">
        <div class="btn-group">
          <div class="tool-btn download">下载原图</div>
          <div class="tool-btn">设为参考图</div>
          <div class="tool-btn slice-btn">切割/表情包</div>
        </div>
      </div>
    </div>
  `
}
