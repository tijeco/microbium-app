import { UI_PALETTE } from '@renderer/constants/color-palettes'
import { arc } from './primitive'

const { PI } = Math

export function drawOrigin (state, ctx) {
  const size = 6

  ctx.globalAlpha = 0.95
  ctx.strokeStyle = UI_PALETTE.BACK_TERTIARY
  ctx.lineWidth = 1.5

  ctx.beginPath()
  arc(ctx,
    0, 0, size,
    0, PI * 2 - Math.PI * 0.2,
    false, Math.PI * 0.2)
  ctx.closePath()
  ctx.stroke()
}

export function drawOriginTick (state, ctx) {
  const { tick } = state.simulation
  const size = 10

  ctx.save()
  ctx.globalAlpha = 0.95
  ctx.strokeStyle = UI_PALETTE.BACK_TERTIARY
  ctx.lineWidth = 1
  ctx.rotate(tick * 0.02, 'z')

  ctx.beginPath()
  ctx.arc(0, 0, size, 0, PI * 0.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, size, PI, PI * 1.5)
  ctx.stroke()

  ctx.restore()
}

export function drawPolarGrid (state, ctx) {
  const radialOffsets = [100, 400, 900]
  const polarIterations = [13, 41, 91]
  const tickSizes = [2, 3, 4]

  ctx.save()

  for (let i = 0; i < radialOffsets.length; i++) {
    const radius = radialOffsets[i]
    const polarSteps = polarIterations[i]
    const tickSize = tickSizes[i]
    const angleStep = PI * 0.5 / polarSteps

    for (let j = 0; j < polarSteps; j++) {
      const isEven = j % 2 === 0
      const length = isEven ? tickSize : tickSize * 3

      ctx.globalAlpha = isEven ? 1 : 0.5
      ctx.lineWidth = 0.5
      ctx.strokeStyle = UI_PALETTE.BACK_TERTIARY

      ctx.beginPath()
      ctx.moveTo(0, radius - length, 0)
      ctx.lineTo(0, radius + length, 0)
      ctx.stroke()
      ctx.rotate(angleStep, 'z')
    }
  }

  ctx.restore()
}
