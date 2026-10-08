use image::{DynamicImage, Rgba32FImage};
use serde_json::Value;
use std::borrow::Cow;

fn number(value: Option<&Value>, default: f32) -> f32 {
    value
        .and_then(Value::as_f64)
        .map(|value| value as f32)
        .filter(|value| value.is_finite())
        .unwrap_or(default)
}

fn point(value: &Value) -> Option<(f32, f32)> {
    let x = number(value.get("x"), f32::NAN);
    let y = number(value.get("y"), f32::NAN);
    (x.is_finite() && y.is_finite()).then_some((x, y))
}

fn sample(image: &Rgba32FImage, x: f32, y: f32) -> Option<[f32; 3]> {
    if x < 0.0 || y < 0.0 || x >= image.width() as f32 || y >= image.height() as f32 {
        return None;
    }
    let pixel = image.get_pixel(
        x.round().min(image.width() as f32 - 1.0) as u32,
        y.round().min(image.height() as f32 - 1.0) as u32,
    );
    Some([pixel[0], pixel[1], pixel[2]])
}

fn stamp(
    mask: &mut [f32],
    bounds: (u32, u32, u32, u32),
    x: f32,
    y: f32,
    radius: f32,
    feather: f32,
) {
    let (left, top, width, height) = bounds;
    if x + radius < left as f32
        || y + radius < top as f32
        || x - radius > (left + width - 1) as f32
        || y - radius > (top + height - 1) as f32
    {
        return;
    }
    let x0 = ((x - radius).floor() as i64).max(left as i64) as u32;
    let y0 = ((y - radius).floor() as i64).max(top as i64) as u32;
    let x1 = ((x + radius).ceil() as i64).clamp(left as i64, (left + width - 1) as i64) as u32;
    let y1 = ((y + radius).ceil() as i64).clamp(top as i64, (top + height - 1) as i64) as u32;
    let inner = radius * (1.0 - feather);
    for py in y0..=y1 {
        for px in x0..=x1 {
            let distance = ((px as f32 - x).powi(2) + (py as f32 - y).powi(2)).sqrt();
            if distance > radius {
                continue;
            }
            let alpha = if distance <= inner || feather <= 0.0 {
                1.0
            } else {
                let t = ((distance - inner) / (radius - inner)).clamp(0.0, 1.0);
                1.0 - t * t * (3.0 - 2.0 * t)
            };
            let index = ((py - top) * width + px - left) as usize;
            mask[index] = mask[index].max(alpha);
        }
    }
}

fn paint_stroke(
    output: &mut Rgba32FImage,
    source: &Rgba32FImage,
    stroke: &Value,
    offset: (f32, f32),
    heal: bool,
    opacity: f32,
) {
    let Some(points) = stroke.get("points").and_then(Value::as_array) else {
        return;
    };
    let points: Vec<_> = points.iter().filter_map(point).collect();
    if points.is_empty() {
        return;
    }
    let radius = (number(stroke.get("brushSize"), 20.0) / 2.0).clamp(0.75, 512.0);
    let feather = number(stroke.get("feather"), 0.25).clamp(0.0, 1.0);
    let left = (points.iter().map(|p| p.0).fold(f32::INFINITY, f32::min) - radius)
        .floor()
        .max(0.0) as u32;
    let top = (points.iter().map(|p| p.1).fold(f32::INFINITY, f32::min) - radius)
        .floor()
        .max(0.0) as u32;
    let right = (points.iter().map(|p| p.0).fold(f32::NEG_INFINITY, f32::max) + radius)
        .ceil()
        .min(output.width() as f32 - 1.0) as u32;
    let bottom = (points.iter().map(|p| p.1).fold(f32::NEG_INFINITY, f32::max) + radius)
        .ceil()
        .min(output.height() as f32 - 1.0) as u32;
    if left > right || top > bottom {
        return;
    }
    let width = right - left + 1;
    let height = bottom - top + 1;
    let Some(size) = (width as usize).checked_mul(height as usize) else {
        return;
    };
    let mut mask = Vec::new();
    if mask.try_reserve_exact(size).is_err() {
        return;
    }
    mask.resize(size, 0.0);
    let bounds = (left, top, width, height);
    for segment in points.windows(2) {
        let (start, end) = (segment[0], segment[1]);
        let distance = (end.0 - start.0).hypot(end.1 - start.1);
        let steps = (distance / (radius * 0.5).max(1.0)).ceil() as u32;
        for step in 0..=steps {
            let t = if steps == 0 {
                0.0
            } else {
                step as f32 / steps as f32
            };
            stamp(
                &mut mask,
                bounds,
                start.0 + (end.0 - start.0) * t,
                start.1 + (end.1 - start.1) * t,
                radius,
                feather,
            );
        }
    }
    if points.len() == 1 {
        stamp(&mut mask, bounds, points[0].0, points[0].1, radius, feather);
    }

    let erase = stroke.get("tool").and_then(Value::as_str) == Some("eraser");
    let mut correction = [0.0f32; 3];
    if heal && !erase {
        let mut total = 0.0;
        let ring = radius * 1.25 + 1.0;
        let directions = [
            (1.0, 0.0),
            (-1.0, 0.0),
            (0.0, 1.0),
            (0.0, -1.0),
            (0.707, 0.707),
            (0.707, -0.707),
            (-0.707, 0.707),
            (-0.707, -0.707),
        ];
        for &(x, y) in points.iter().step_by((points.len() / 24).max(1)) {
            for &(dx, dy) in &directions {
                let ring_x = x + dx * ring;
                let ring_y = y + dy * ring;
                if let (Some(sampled), Some(target)) = (
                    sample(source, ring_x + offset.0, ring_y + offset.1),
                    sample(output, ring_x, ring_y),
                ) {
                    for channel in 0..3 {
                        correction[channel] += target[channel] - sampled[channel];
                    }
                    total += 1.0;
                }
            }
        }
        if total > 0.0 {
            for channel in &mut correction {
                *channel /= total;
            }
        }
    }

    for py in top..=bottom {
        for px in left..=right {
            let alpha = mask[((py - top) * width + px - left) as usize] * opacity;
            if alpha <= 0.0 {
                continue;
            }
            let sampled = if erase {
                sample(source, px as f32, py as f32)
            } else {
                sample(source, px as f32 + offset.0, py as f32 + offset.1)
            };
            let Some(sampled) = sampled else {
                continue;
            };
            let target = output.get_pixel_mut(px, py);
            for channel in 0..3 {
                let replacement = if heal && !erase {
                    (sampled[channel] + correction[channel]).max(0.0)
                } else {
                    sampled[channel]
                };
                target[channel] = target[channel] * (1.0 - alpha) + replacement * alpha;
            }
        }
    }
}

pub fn composite_spot_removals(base: &DynamicImage, adjustments: &Value) -> DynamicImage {
    let Some(containers) = adjustments.get("masks").and_then(Value::as_array) else {
        return base.clone();
    };
    let mut result: Option<Rgba32FImage> = None;
    let mut source: Option<Cow<'_, Rgba32FImage>> = None;
    for container in containers {
        if container.get("visible").and_then(Value::as_bool) == Some(false) {
            continue;
        }
        let container_opacity = (number(container.get("opacity"), 100.0) / 100.0).clamp(0.0, 1.0);
        let Some(sub_masks) = container.get("subMasks").and_then(Value::as_array) else {
            continue;
        };
        for sub_mask in sub_masks {
            let kind = sub_mask.get("type").and_then(Value::as_str);
            if !matches!(kind, Some("clone" | "heal"))
                || sub_mask.get("visible").and_then(Value::as_bool) == Some(false)
            {
                continue;
            }
            let Some(parameters) = sub_mask.get("parameters") else {
                continue;
            };
            let (source_x, source_y) = (
                number(parameters.get("sourceX"), f32::NAN),
                number(parameters.get("sourceY"), f32::NAN),
            );
            if !source_x.is_finite() || !source_y.is_finite() {
                continue;
            }
            let Some(lines) = parameters.get("lines").and_then(Value::as_array) else {
                continue;
            };
            let Some(anchor) = lines
                .iter()
                .filter(|line| line.get("tool").and_then(Value::as_str) != Some("eraser"))
                .filter_map(|line| {
                    line.get("points")
                        .and_then(Value::as_array)?
                        .first()
                        .and_then(point)
                })
                .next()
            else {
                continue;
            };
            let source_image = source.get_or_insert_with(|| match base {
                DynamicImage::ImageRgba32F(pixels) => Cow::Borrowed(pixels),
                _ => Cow::Owned(base.to_rgba32f()),
            });
            let output = result.get_or_insert_with(|| source_image.as_ref().clone());
            let opacity = container_opacity
                * (number(sub_mask.get("opacity"), 100.0) / 100.0).clamp(0.0, 1.0);
            let offset = (source_x - anchor.0, source_y - anchor.1);
            for line in lines {
                paint_stroke(
                    output,
                    source_image.as_ref(),
                    line,
                    offset,
                    kind == Some("heal"),
                    opacity,
                );
            }
        }
    }
    result
        .map(DynamicImage::ImageRgba32F)
        .unwrap_or_else(|| base.clone())
}

pub fn has_spot_removals(adjustments: &Value) -> bool {
    adjustments
        .get("masks")
        .and_then(Value::as_array)
        .is_some_and(|containers| {
            containers.iter().any(|container| {
                if container.get("visible").and_then(Value::as_bool) == Some(false) {
                    return false;
                }
                container
                    .get("subMasks")
                    .and_then(Value::as_array)
                    .is_some_and(|sub_masks| {
                        sub_masks.iter().any(|sub_mask| {
                            sub_mask.get("visible").and_then(Value::as_bool) != Some(false)
                                && matches!(
                                    sub_mask.get("type").and_then(Value::as_str),
                                    Some("clone" | "heal")
                                )
                                && sub_mask.get("parameters").is_some_and(|parameters| {
                                    number(parameters.get("sourceX"), f32::NAN).is_finite()
                                        && number(parameters.get("sourceY"), f32::NAN).is_finite()
                                        && parameters
                                            .get("lines")
                                            .and_then(Value::as_array)
                                            .is_some_and(|lines| !lines.is_empty())
                                })
                        })
                    })
            })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;
    use serde_json::json;

    #[test]
    fn clone_uses_selected_source_and_preserves_original() {
        let mut image = Rgba32FImage::from_pixel(12, 8, Rgba([0.1, 0.1, 0.1, 1.0]));
        image.put_pixel(2, 2, Rgba([0.8, 0.4, 0.2, 1.0]));
        let base = DynamicImage::ImageRgba32F(image);
        let edits = json!({"masks": [{"visible": true, "opacity": 100, "subMasks": [{"type": "clone", "visible": true, "opacity": 100, "parameters": {"sourceX": 2, "sourceY": 2, "lines": [{"brushSize": 2, "feather": 0, "points": [{"x": 7, "y": 2}]}]}}]}]});
        let result = composite_spot_removals(&base, &edits).to_rgba32f();
        assert_eq!(result.get_pixel(7, 2)[0], 0.8);
        assert_eq!(base.to_rgba32f().get_pixel(7, 2)[0], 0.1);
    }

    #[test]
    fn heal_replaces_blemish_using_source_texture() {
        let mut image = Rgba32FImage::from_pixel(12, 8, Rgba([0.2, 0.2, 0.2, 1.0]));
        image.put_pixel(2, 2, Rgba([0.4, 0.4, 0.4, 1.0]));
        image.put_pixel(7, 2, Rgba([0.9, 0.9, 0.9, 1.0]));
        let base = DynamicImage::ImageRgba32F(image);
        let edits = json!({"masks": [{"subMasks": [{"type": "heal", "parameters": {"sourceX": 2, "sourceY": 2, "lines": [{"brushSize": 2, "feather": 0, "points": [{"x": 7, "y": 2}]}]}}]}]});
        let result = composite_spot_removals(&base, &edits).to_rgba32f();
        assert!((result.get_pixel(7, 2)[0] - 0.4).abs() < 0.001);
    }
}
