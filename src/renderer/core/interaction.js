import { vec2, vec3 } from 'gl-matrix'
import { clamp, mapLinear } from '@renderer/utils/math'

export function createSeekController (tasks, state) {
  const { requestSync } = tasks

  const seek = {
    pointerMove (event) {
      const stateSeek = state.seek
      const { activeSegment } = state.geometry
      const { shouldNavigate, isDragging, isDrawing } = state.drag
      const { scale } = state.viewport
      const { isRunning } = state.simulation
      const {
        screen, move, movePrev,
        proximateIndices, proximateDistance
      } = stateSeek

      vec2.set(screen, event.clientX, event.clientY)
      vec2.copy(movePrev, move)
      vec2.copy(move, screen)
      requestSync('viewport.projectScreen', move)

      const dist = vec2.distance(movePrev, move)
      const time = Date.now()
      const timeDiff = time - (stateSeek.timePrev || Date.now())
      const velocity = timeDiff > 0 ? (dist / timeDiff) : stateSeek.velocity

      stateSeek.velocity = velocity
      stateSeek.velocitySmoothed += (velocity - stateSeek.velocitySmoothed) * 0.05
      stateSeek.timePrev = time
      proximateIndices.length = 0

      if (isRunning || shouldNavigate || isDragging) {
        stateSeek.index = null
        return
      }

      const lastOffset = isDrawing ? 1 : 0
      const ignoreIndex = (isDrawing && activeSegment)
        ? activeSegment.indices[activeSegment.indices.length - 2]
        : -1
      const close = requestSync('geometry.findClosestPoint',
        move, stateSeek.maxDistance / scale, lastOffset, ignoreIndex,
        proximateIndices, proximateDistance)
      stateSeek.index = close ? close.index : null
    },

    wheelOffset (event) {
      const { deltaY } = event
      const stateSeek = state.seek
      stateSeek.wheelOffset = clamp(-1, 1,
        stateSeek.wheelOffset + deltaY * 0.001)
    },

    handMove (frame) {
      const { hand } = state.seek
      const { size } = state.viewport
      const pointable0 = frame.pointables[0]
      const pos = pointable0.tipPosition

      vec3.set(hand,
        mapLinear(-80, 80, 0, size[0], pos[0]),
        mapLinear(-80, 80, 0, size[1], pos[2]),
        mapLinear(0, 200, 0, 1, pos[1]))

      requestSync('viewport.projectScreen', hand)
    }
  }

  tasks.registerResponders([
    'wheelOffset'
  ], seek, 'seek')

  return seek
}

export function createDragController (tasks, state) {
  const { requestSync } = tasks

  const drag = {
    pointerDown (event) {
      const stateDrag = state.drag
      const { isRunning } = state.simulation
      const { isDown, shouldNavigate, shouldZoom, down } = stateDrag

      if (isRunning && !shouldNavigate) return
      if (isDown || stateDrag.isDrawing) {
        stateDrag.isDown = true
        return
      }

      const isDrawing = !shouldNavigate
      const isPanning = shouldNavigate && !shouldZoom
      const isZooming = shouldNavigate && shouldZoom

      vec2.set(down, event.clientX, event.clientY)
      requestSync('viewport.projectScreen', down)

      stateDrag.isDown = true
      stateDrag.isDrawing = isDrawing
      stateDrag.isPanning = isPanning
      stateDrag.isZooming = isZooming
      drag.updatePressure(event)

      if (isDrawing) drag.beginDraw(down)
      else if (isPanning) drag.beginPan(down)
      else if (isZooming) drag.beginZoom(down)

      document.addEventListener('pointermove', drag.pointerMove, false)
      document.addEventListener('pointerup', drag.pointerUp, false)
      event.preventDefault()
    },

    // TODO: Manage different interactions / commands separately
    pointerMove (event) {
      const stateDrag = state.drag
      const { velocity } = state.seek
      const {
        isDown, isDrawing, isPanning, isZooming,
        move, movePrev
      } = stateDrag

      vec2.copy(movePrev, move)
      vec2.set(move, event.clientX, event.clientY)
      requestSync('viewport.projectScreen', move)

      if (isDown) {
        stateDrag.isDragging = true
        drag.updatePressure(event)
      }

      if (isDrawing) drag.moveDraw(move, velocity)
      else if (isPanning) drag.movePan(move, velocity)
      else if (isZooming) drag.moveZoom(move, velocity)

      event.preventDefault()
    },

    pointerUp (event) {
      const stateDrag = state.drag
      const stateGeom = state.geometry
      const {
        isDrawing, isPanning, isZooming,
        up, upPrev, upTimeLast
      } = stateDrag

      const time = Date.now()
      const timeDiff = time - upTimeLast

      vec2.copy(upPrev, up)
      vec2.set(up, event.clientX, event.clientY)
      requestSync('viewport.projectScreen', up)

      stateDrag.isDown = false
      stateDrag.isDragging = false

      if (isDrawing && timeDiff > 200) {
        stateGeom.shouldAppendOnce = true
      } else {
        stateDrag.isDrawing = false
        stateDrag.isPanning = false
        stateDrag.isZooming = false

        if (isDrawing) drag.endDraw(up)
        else if (isPanning) drag.endPan(up)
        else if (isZooming) drag.endZoom(up)

        document.removeEventListener('pointermove', drag.pointerMove)
        document.removeEventListener('pointerup', drag.pointerUp)
      }

      stateDrag.upTimeLast = time
      event.preventDefault()
    },

    updatePressure (event) {
      state.drag.pressure = event.pressure
    },

    // FEAT: Add damping / improve feel to panning and zooming
    beginPan (down) {},

    movePan (move, velocity) {
      const { panOffset, down } = state.drag
      const { scale } = state.viewport

      vec2.sub(panOffset, move, down)
      vec2.scale(panOffset, panOffset, scale)
    },

    endPan (up) {
      const { panOffset } = state.drag
      const { offset } = state.viewport

      vec2.add(offset, offset, panOffset)
      vec2.set(panOffset, 0, 0)
    },

    beginZoom (down) {},

    moveZoom (move, velocity) {
      const { down, panOffset } = state.drag
      const { offset, size, scale } = state.viewport
      const diff = (move[1] - down[1]) * scale
      const nextZoomOffset = diff / (size[1] / scale * 0.4)

      vec2.copy(panOffset, offset)
      vec2.scale(panOffset, panOffset, nextZoomOffset / scale)
      state.drag.zoomOffset = nextZoomOffset
    },

    endZoom (up) {
      const { panOffset, zoomOffset } = state.drag
      const { offset, scale } = state.viewport

      state.viewport.scale = scale + zoomOffset
      state.drag.zoomOffset = 0
      vec2.add(offset, offset, panOffset)
      vec2.set(panOffset, 0, 0)
    },

    beginDraw (down) {
      const { maxDistance } = state.seek
      const { scale } = state.viewport

      const close = requestSync('geometry.findClosestPoint',
        down, maxDistance / scale)

      state.geometry.activeDepth = state.controls.lineTool.depth

      if (close) {
        const connections = requestSync('geometry.findConnectedSegments', close.index)
        if (connections) {
          const { index, segment } = connections[0]
          const depth = segment.depths[index]
          state.geometry.activeDepth = depth
        }
        requestSync('geometry.createSegment', close.point, close.index)
      } else {
        requestSync('geometry.createSegment', down)
      }
    },

    moveDraw (move, velocity) {
      const { isDown } = state.drag
      const { index } = state.seek

      state.geometry.shouldAppend = isDown
      requestSync('geometry.updateActiveSegment', move, index)
    },

    endDraw (up) {
      const { maxDistance } = state.seek
      const { scale } = state.viewport

      const close = requestSync('geometry.findClosestPoint',
        up, maxDistance / scale, 1)

      requestSync('geometry.completeActiveSegment', close && close.index)
    },

    cancelDraw () {
      state.drag.isDrawing = false
    },

    wheelPan (event) {
      const { deltaX, deltaY } = event
      const { panOffset } = state.drag
      const { offset, scale } = state.viewport

      vec2.set(panOffset, -deltaX, -deltaY)
      vec2.scale(panOffset, panOffset, scale)

      vec2.add(offset, offset, panOffset)
      vec2.set(panOffset, 0, 0)
    },

    wheelZoom (event) {
      const { deltaY } = event
      const { panOffset } = state.drag
      const { offset, size, scale } = state.viewport

      const diff = -deltaY * scale * 2
      const nextZoomOffset = diff / (size[1] / scale * 0.4)

      vec2.copy(panOffset, offset)
      vec2.scale(panOffset, panOffset, nextZoomOffset / scale)
      state.drag.zoomOffset = nextZoomOffset

      state.viewport.scale = scale + nextZoomOffset
      state.drag.zoomOffset = 0
      vec2.add(offset, offset, panOffset)
      vec2.set(panOffset, 0, 0)
    }
  }

  tasks.registerResponders([
    'cancelDraw',
    'wheelPan',
    'wheelZoom'
  ], drag, 'drag')

  return drag
}
