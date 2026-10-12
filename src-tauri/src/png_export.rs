use image::{DynamicImage, ImageEncoder};

pub fn encode_png(image: &DynamicImage, depth: u8, srgb_profile: &[u8]) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    match depth {
        1 | 2 | 4 => {
            let gray = image.to_luma8();
            let (width, height) = gray.dimensions();
            let stride = (width as usize * depth as usize).div_ceil(8);
            let mut packed = vec![0_u8; stride * height as usize];
            let levels = (1_u32 << depth) - 1;
            for (x, y, pixel) in gray.enumerate_pixels() {
                let value = ((u32::from(pixel[0]) * levels + 127) / 255) as u8;
                let bit = x as usize * depth as usize;
                packed[y as usize * stride + bit / 8] |= value << (8 - depth as usize - bit % 8);
            }
            let mut encoder = png::Encoder::new(&mut bytes, width, height);
            encoder.set_color(png::ColorType::Grayscale);
            encoder.set_depth(match depth {
                1 => png::BitDepth::One,
                2 => png::BitDepth::Two,
                _ => png::BitDepth::Four,
            });
            encoder.set_source_srgb(png::SrgbRenderingIntent::Perceptual);
            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
            writer
                .write_image_data(&packed)
                .map_err(|e| e.to_string())?;
            writer.finish().map_err(|e| e.to_string())?;
        }
        8 | 16 => {
            let alpha = image.color().has_alpha();
            let output = match (depth, alpha) {
                (8, false) => DynamicImage::ImageRgb8(image.to_rgb8()),
                (8, true) => DynamicImage::ImageRgba8(image.to_rgba8()),
                (16, false) => DynamicImage::ImageRgb16(image.to_rgb16()),
                _ => DynamicImage::ImageRgba16(image.to_rgba16()),
            };
            let mut encoder = image::codecs::png::PngEncoder::new(&mut bytes);
            encoder
                .set_icc_profile(srgb_profile.to_vec())
                .map_err(|e| e.to_string())?;
            output
                .write_with_encoder(encoder)
                .map_err(|e| e.to_string())?;
        }
        _ => {
            return Err(format!(
                "Invalid PNG bit depth {depth}; expected 1, 2, 4, 8 or 16."
            ));
        }
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Luma, Rgb};

    #[test]
    fn all_png_depths_and_non_byte_aligned_rows_round_trip() {
        let input = DynamicImage::ImageLuma8(ImageBuffer::from_fn(9, 2, |x, y| {
            Luma([((x + y) * 25) as u8])
        }));
        for depth in [1, 2, 4, 8, 16] {
            let bytes =
                encode_png(&input, depth, include_bytes!("../icc/sRGB-v2-magic.icc")).unwrap();
            assert_eq!(bytes[24], depth);
            assert_eq!(bytes[25], if depth < 8 { 0 } else { 2 });
            let decoded = image::load_from_memory(&bytes).unwrap();
            assert_eq!((decoded.width(), decoded.height()), (9, 2));
            if depth < 8 {
                let levels = (1_u32 << depth) - 1;
                for (actual, original) in decoded.to_luma8().pixels().zip(input.to_luma8().pixels())
                {
                    let expected = ((u32::from(original[0]) * levels + 127) / 255) * 255 / levels;
                    assert_eq!(u32::from(actual[0]), expected);
                }
            }
        }
        assert!(encode_png(&input, 3, &[]).is_err());
    }

    #[test]
    fn sixteen_bit_png_preserves_samples() {
        let input =
            DynamicImage::ImageRgb16(ImageBuffer::from_pixel(2, 1, Rgb([12345, 23456, 45678])));
        let bytes = encode_png(&input, 16, include_bytes!("../icc/sRGB-v2-magic.icc")).unwrap();
        assert_eq!(
            image::load_from_memory(&bytes).unwrap().to_rgb16(),
            input.to_rgb16()
        );
    }
}
