import scratchpadTools from "./scratchpad-tools";
import type {
  ConstantBrush,
  Tool,
  ToolSet,
  VariableBrush,
} from "./scratchpad-tools";

const variableStrokeFromTouchStroke = (stroke, brush: VariableBrush) => {
  const {
    slowBrushWidth,
    fastBrushWidth,
    fastBrushWidthVelocity,
  } = brush;

  let runningVelocity = 30;
  const velocitySmoothing = 0.8;
  const drawnSamples = [];
  for (
    let sampleIndex = 0;
    sampleIndex < stroke.samples.length;
    sampleIndex++
  ) {
    const sample = stroke.samples[sampleIndex];
    let currentVelocity;
    if (sampleIndex == 0) {
      currentVelocity = runningVelocity;
    } else {
      const lastSample = stroke.samples[sampleIndex - 1];
      const dx = sample.x - lastSample.x;
      const dy = sample.y - lastSample.y;
      currentVelocity = Math.sqrt(dx * dx + dy * dy);
    }
    runningVelocity = velocitySmoothing * runningVelocity +
      (1 - velocitySmoothing) * currentVelocity;

    drawnSamples.push({
      x: sample.x,
      y: sample.y,
      w: Math.min(
        slowBrushWidth,
        Math.max(
          fastBrushWidth,
          (fastBrushWidthVelocity - runningVelocity) /
            fastBrushWidthVelocity *
            (slowBrushWidth - fastBrushWidth) +
            fastBrushWidth,
        ),
      ),
    });
  }

  return {
    color: stroke.color,
    tool: stroke.tool,
    samples: drawnSamples,
  };
};

const smoothedStrokeFromDrawnStroke = (stroke, tool: ToolSpec) => {
  // Quadratically interpolate between the samples.
  const smoothedSamples = stroke.samples.slice(0, 1);
  for (
    let sampleIndex = 2;
    sampleIndex < stroke.samples.length;
    sampleIndex++
  ) {
    const lastLastSample = stroke.samples[sampleIndex - 2];
    const lastSample = stroke.samples[sampleIndex - 1];
    const sample = stroke.samples[sampleIndex];

    const lastMidpointX = (lastSample.x + lastLastSample.x) / 2;
    const lastMidpointY = (lastSample.y + lastLastSample.y) / 2;
    const midpointX = (sample.x + lastSample.x) / 2;
    const midpointY = (sample.y + lastSample.y) / 2;

    const segmentPixelLength = tool.subdivisionLength;
    const midpointDistance = Math.sqrt(
      (midpointX - lastMidpointX) * (midpointX - lastMidpointX) +
        (midpointY - lastMidpointY) * (midpointY - lastMidpointY),
    );
    const interpolatedSegmentCount = Math.min(
      64,
      Math.max(Math.floor(midpointDistance / segmentPixelLength), 1),
    );
    let t = 0.0;
    const step = 1.0 / interpolatedSegmentCount;
    for (
      let segmentIndex = 0;
      segmentIndex < interpolatedSegmentCount;
      segmentIndex++
    ) {
      smoothedSamples.push({
        x: lastMidpointX * Math.pow(1 - t, 2) +
          lastSample.x * 2.0 * (1 - t) * t +
          midpointX * t * t,
        y: lastMidpointY * Math.pow(1 - t, 2) +
          lastSample.y * 2.0 * (1 - t) * t +
          midpointY * t * t,
        w: Math.pow(1 - t, 2) * ((lastSample.w + lastLastSample.w) / 2.0) +
          2.0 * (1 - t) * t * lastSample.w +
          t * t * ((sample.w + lastSample.w) / 2.0),
      });

      t += step;
    }
  }

  return { ...stroke, samples: smoothedSamples };
};

const constantStrokeFromTouchStroke = (stroke, brush: ConstantBrush) => {
  return { ...stroke, w: brush.brushWidth };
};

const smoothedStrokeFromTouchStroke = (touchStroke, toolSet: ToolSet) => {
  const toolSpec = toolSet[(touchStroke.tool: Tool)];
  const brush = toolSpec.brush;
  const brushStroke = brush.brushType === "variable"
    ? variableStrokeFromTouchStroke(touchStroke, brush)
    : constantStrokeFromTouchStroke(touchStroke, brush);
  const smoothedStroke = smoothedStrokeFromDrawnStroke(brushStroke, toolSpec);
  return smoothedStroke;
};

export { smoothedStrokeFromTouchStroke };
