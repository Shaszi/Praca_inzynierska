import type { PointerEventHandler, RefObject } from 'react'

type CanvasRendererProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  onPointerDown: PointerEventHandler<HTMLCanvasElement>
  onPointerMove: PointerEventHandler<HTMLCanvasElement>
  onPointerUp: PointerEventHandler<HTMLCanvasElement>
  onPointerEnter?: PointerEventHandler<HTMLCanvasElement>
  onPointerOut?: PointerEventHandler<HTMLCanvasElement>
}

export function CanvasRenderer({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerOut,
}: CanvasRendererProps) {
  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerOut={onPointerOut}
      onContextMenu={(event) => event.preventDefault()}
      className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
    />
  )
}