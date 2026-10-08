import json
from pathlib import Path

LOCALES_DIR = Path("./locales")

TRANSLATIONS = {
    "ca": {
        "settings": {
            "controls": {
                "zoomClick": "Amplia la foto al 100%",
                "zoomClickDesc": "Amplia la foto a l'editor al 100% en fer clic",
                "zoomClickInfo": "Fes clic a la foto per ampliar-la directament al 100% (píxels 1:1) per avaluar-ne la nitidesa i el soroll. Quan està desactivat, en fer clic s'amplia gradualment."
            }
        }
    },
    "de": {
        "settings": {
            "controls": {
                "zoomClick": "Foto auf 100% zoomen",
                "zoomClickDesc": "Foto im Editor bei Mausklick auf 100% zoomen",
                "zoomClickInfo": "Klicken Sie auf das Foto, um sofort auf 100% (1:1 Pixel) zu zoomen, um Schärfe und Rauschen zu beurteilen. Wenn deaktiviert, wird beim Klicken stufenweise herangezoomt."
            }
        }
    },
    "en": {
        "settings": {
            "controls": {
                "zoomClick": "Zoom photo to 100%",
                "zoomClickDesc": "Zoom photo in editor to 100% on mouse click",
                "zoomClickInfo": "Click the photo to instantly zoom to 100% (1:1 pixels) to assess sharpness and noise. When disabled, clicking zooms in gradually."
            }
        }
    },
    "es": {
        "settings": {
            "controls": {
                "zoomClick": "Zoom de foto al 100%",
                "zoomClickDesc": "Ampliar foto en el editor al 100% al hacer clic",
                "zoomClickInfo": "Haz clic en la foto para ampliarla directamente al 100% (píxeles 1:1) para evaluar la nitidez y el ruido. Cuando está desactivado, al hacer clic se acerca gradualmente."
            }
        }
    },
    "fr": {
        "settings": {
            "controls": {
                "zoomClick": "Zoomer la photo à 100 %",
                "zoomClickDesc": "Zoomer la photo dans l'éditeur à 100 % au clic",
                "zoomClickInfo": "Cliquez sur la photo pour zoomer instantanément à 100 % (pixels 1:1) afin d'évaluer la netteté et le bruit. S'il est désactivé, le clic effectue un zoom progressif."
            }
        }
    },
    "it": {
        "settings": {
            "controls": {
                "zoomClick": "Zoom foto al 100%",
                "zoomClickDesc": "Zoom della foto nell'editor al 100% al clic",
                "zoomClickInfo": "Fai clic sulla foto per ingrandirla istantaneamente al 100% (pixel 1:1) per valutare nitidezza e rumore. Se disabilitato, il clic ingrandisce gradualmente."
            }
        }
    },
    "ja": {
        "settings": {
            "controls": {
                "zoomClick": "写真を100%にズーム",
                "zoomClickDesc": "クリック時にエディターの写真を100%にズーム",
                "zoomClickInfo": "写真をクリックするとすぐに100%（1:1 ピクセル）にズームされ、シャープネスとノイズを確認できます。無効の場合、クリックすると段階的にズームインします。"
            }
        }
    },
    "ko": {
        "settings": {
            "controls": {
                "zoomClick": "사진 100% 확대",
                "zoomClickDesc": "클릭 시 에디터의 사진을 100% 확대",
                "zoomClickInfo": "사진을 클릭하면 즉시 100%(1:1 픽셀)로 확대되어 선명도와 노이즈를 평가할 수 있습니다. 비활성화된 경우 클릭하면 점진적으로 확대됩니다."
            }
        }
    },
    "pl": {
        "settings": {
            "controls": {
                "zoomClick": "Powiększ zdjęcie do 100%",
                "zoomClickDesc": "Powiększ zdjęcie w edytorze do 100% po kliknięciu",
                "zoomClickInfo": "Kliknij zdjęcie, aby natychmiast powiększyć je do 100% (piksele 1:1) w celu oceny ostrości i szumu. Jeśli wyłączone, kliknięcie przybliża stopniowo."
            }
        }
    },
    "pt": {
        "settings": {
            "controls": {
                "zoomClick": "Zoom da foto para 100%",
                "zoomClickDesc": "Ampliar foto no editor para 100% ao clicar",
                "zoomClickInfo": "Clique na foto para ampliar instantaneamente para 100% (pixels 1:1) para avaliar a nitidez e o ruído. Quando desativado, clicar aproxima gradualmente."
            }
        }
    },
    "ru": {
        "settings": {
            "controls": {
                "zoomClick": "Масштаб фото 100%",
                "zoomClickDesc": "Масштабировать фото в редакторе до 100% по клику",
                "zoomClickInfo": "Нажмите на фото, чтобы мгновенно увеличить его до 100% (1:1 в пикселях) для оценки резкости и шума. Если отключено, клик приближает постепенно."
            }
        }
    },
    "zh-CN": {
        "settings": {
            "controls": {
                "zoomClick": "缩放照片至 100%",
                "zoomClickDesc": "点击时将编辑器中的照片缩放至 100%",
                "zoomClickInfo": "点击照片可立即缩放至 100%（1:1 像素），以评估清晰度和噪点。禁用时，点击会逐步放大。"
            }
        }
    },
    "zh-TW": {
        "settings": {
            "controls": {
                "zoomClick": "縮放照片至 100%",
                "zoomClickDesc": "點擊時將編輯器中的照片縮放至 100%",
                "zoomClickInfo": "點擊照片可立即縮放至 100%（1:1 像素），以評估清晰度和雜訊。停用時，點擊會逐步放大。"
            }
        }
    }
}

def deep_merge(target: dict, source: dict):
    """Recursively merges source dict into target dict."""
    for key, value in source.items():
        if isinstance(value, dict):
            node = target.setdefault(key, {})
            if isinstance(node, dict):
                deep_merge(node, value)
        else:
            target[key] = value

def sort_dict_recursively(item):
    if isinstance(item, dict):
        return {k: sort_dict_recursively(v) for k, v in sorted(item.items())}
    elif isinstance(item, list):
        return [sort_dict_recursively(x) for x in item]
    return item

def update_json_file(file_path: Path, trans: dict):
    if not file_path.exists():
        print(f"Skipping: {file_path.name} (File not found)")
        return

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        print(f"Error parsing JSON in {file_path.name}. Skipping.")
        return

    # 1. Merge new translations
    deep_merge(data, trans)

    # 2. Sort alphabetically to maintain formatting consistency
    sorted_data = sort_dict_recursively(data)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Updated and Sorted: {file_path.name}")

def main():
    if not LOCALES_DIR.exists():
        print(f"Error: Locales directory '{LOCALES_DIR}' does not exist.")
        return

    print("Starting translation updates for zoomClick settings...")
    for lang, trans in TRANSLATIONS.items():
        file_path = LOCALES_DIR / f"{lang}.json"
        update_json_file(file_path, trans)
    print("Done!")

if __name__ == "__main__":
    main()
