use image::DynamicImage;

#[inline]
fn smootherstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}

#[inline]
fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[inline]
fn recover_clipped_pixel(r: f32, g: f32, b: f32, amount: f32) -> (f32, f32, f32) {
    if amount <= 0.0 {
        return (r, g, b);
    }
    let max_c = r.max(g).max(b);
    if max_c <= 0.50 {
        return (r, g, b);
    }

    let mut cur_r = r;
    let mut cur_g = g;
    let mut cur_b = b;
    let strength = (amount / 2.5).clamp(0.0, 4.0);
    let outer_blend = 1.0 - (1.0 - smootherstep(0.50, 1.5, max_c)).powf(strength);

    let magenta = (cur_r.min(cur_b) - cur_g).max(0.0);
    if magenta > 0.0 {
        let target_g = cur_r.min(cur_b) * 0.80 + ((cur_r + cur_b) * 0.5) * 0.20;
        let correction = (target_g - cur_g).max(0.0);
        cur_g += correction * outer_blend;
    }

    let residual = (cur_r.min(cur_b) - cur_g).max(0.0);
    if residual > 0.0 {
        cur_g += residual * outer_blend;
    }

    let new_max = cur_r.max(cur_g).max(cur_b);
    let min_c = cur_r.min(cur_g).min(cur_b);
    let knee = 1.0 - (1.0 - smoothstep(0.50, 1.5, new_max)).powf(strength);

    if knee > 0.0 {
        let neutrality = (min_c / new_max.max(1e-5)).clamp(0.0, 1.0);
        let core_burn = smoothstep(0.60, 3.0, new_max);
        let desat = (knee * (neutrality * 0.85 + core_burn * 0.15)).clamp(0.0, 1.0);
        let smooth_desat = desat * desat * (3.0 - 2.0 * desat);
        let neutral_value = min_c + (new_max - min_c);

        cur_r = cur_r * (1.0 - smooth_desat) + neutral_value * smooth_desat;
        cur_g = cur_g * (1.0 - smooth_desat) + neutral_value * smooth_desat;
        cur_b = cur_b * (1.0 - smooth_desat) + neutral_value * smooth_desat;
    }

    (cur_r, cur_g, cur_b)
}

pub fn apply_highlight_recovery(image: &mut DynamicImage, amount: f32) {
    if amount <= 0.0 {
        return;
    }
    match image {
        DynamicImage::ImageRgb32F(pixels) => {
            for pixel in pixels.pixels_mut() {
                let (r, g, b) = recover_clipped_pixel(pixel[0], pixel[1], pixel[2], amount);
                pixel[0] = r;
                pixel[1] = g;
                pixel[2] = b;
            }
        }
        DynamicImage::ImageRgba32F(pixels) => {
            for pixel in pixels.pixels_mut() {
                let (r, g, b) = recover_clipped_pixel(pixel[0], pixel[1], pixel[2], amount);
                pixel[0] = r;
                pixel[1] = g;
                pixel[2] = b;
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::recover_clipped_pixel;

    #[test]
    fn recovery_can_be_disabled_and_strength_changes_output() {
        let input = (1.4, 0.2, 1.2);
        assert_eq!(recover_clipped_pixel(input.0, input.1, input.2, 0.0), input);
        let weak = recover_clipped_pixel(input.0, input.1, input.2, 1.0);
        let strong = recover_clipped_pixel(input.0, input.1, input.2, 8.0);
        assert!(weak.1 > input.1);
        assert!(strong.1 > weak.1);
    }
}
