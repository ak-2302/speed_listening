#!/usr/bin/env python3
"""教材JSONの検証とOpen JTalk音声の一括生成を行う。"""

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT_DIR / "materials"
DEFAULT_PUBLIC_DIR = ROOT_DIR / "public"
DEFAULT_DICTIONARY = DEFAULT_PUBLIC_DIR / "assets" / "dic"
DEFAULT_VOICE = DEFAULT_PUBLIC_DIR / "assets" / "tohoku-f01-neutral.htsvoice"

def load_materials(path: Path) -> list[dict]:
    """教材JSONを読み込む。"""
    with path.open(encoding="utf-8") as file:
        materials = json.load(file)
    if not isinstance(materials, list):
        raise ValueError("教材JSONのルートは配列にしてください。")
    return materials


def load_material_files(input_dir: Path) -> list[dict]:
    """入力ディレクトリ内の教材JSONをすべて読み込む。"""
    files = sorted(path for path in input_dir.glob("*.json") if path.name != "index.json")
    if not files:
        raise FileNotFoundError(f"教材JSONがありません: {input_dir}")
    materials = []
    for path in files:
        loaded = load_materials(path)
        materials.extend(loaded)
    return materials


def validate_materials(materials: list[dict]) -> None:
    """教材ID、本文、問題、正解の整合性を検証する。"""
    material_ids: set[str] = set()
    for material in materials:
        material_id = material.get("id")
        if not isinstance(material_id, str) or not material_id:
            raise ValueError("教材IDは空でない文字列にしてください。")
        if material_id in material_ids:
            raise ValueError(f"教材IDが重複しています: {material_id}")
        material_ids.add(material_id)
        if not isinstance(material.get("title"), str) or not material["title"].strip():
            raise ValueError(f"教材タイトルが空です: {material_id}")
        if not isinstance(material.get("body"), str) or not material["body"].strip():
            raise ValueError(f"教材本文が空です: {material_id}")
        question_ids: set[str] = set()
        for question in material.get("questions", []):
            question_id = question.get("id")
            if not isinstance(question_id, str) or not question_id or question_id in question_ids:
                raise ValueError(f"問題IDが不正または重複しています: {material_id}")
            question_ids.add(question_id)
            choices = question.get("choices")
            choice_ids = {choice.get("id") for choice in choices or []}
            if len(choice_ids) < 2 or None in choice_ids:
                raise ValueError(f"選択肢が不足しています: {question_id}")
            if question.get("answerId") not in choice_ids:
                raise ValueError(f"正解が選択肢にありません: {question_id}")
            if not question.get("prompt", "").strip() or not question.get("explanation", "").strip():
                raise ValueError(f"問題文または解説が空です: {question_id}")


def synthesize_materials(materials: list[dict], output_dir: Path, open_jtalk: str, ffmpeg: str, dictionary: Path, voice: Path) -> None:
    """Open JTalkで生成した音声をOpus Oggへ変換する。"""
    command = shutil.which(open_jtalk) or open_jtalk
    if shutil.which(command) is None and not Path(command).exists():
        raise FileNotFoundError(f"Open JTalkが見つかりません: {open_jtalk}")
    ffmpeg_command = shutil.which(ffmpeg) or ffmpeg
    if shutil.which(ffmpeg_command) is None and not Path(ffmpeg_command).exists():
        raise FileNotFoundError(f"FFmpegが見つかりません: {ffmpeg}")
    if not dictionary.is_dir():
        raise FileNotFoundError(f"辞書ディレクトリが見つかりません: {dictionary}")
    if not voice.is_file():
        raise FileNotFoundError(f"音声ファイルが見つかりません: {voice}")
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary_dir:
        text_dir = Path(temporary_dir)
        for material in materials:
            text_path = text_dir / f"{material['id']}.txt"
            wav_path = text_dir / f"{material['id']}.wav"
            audio_path = output_dir / f"{material['id']}.ogg"
            text_path.write_text(material["body"], encoding="utf-8")
            subprocess.run(
                [command, "-x", str(dictionary), "-m", str(voice), "-ow", str(wav_path), str(text_path)],
                check=True,
            )
            subprocess.run([ffmpeg_command, "-y", "-i", str(wav_path), "-c:a", "libopus", "-b:a", "32k", str(audio_path)], check=True, capture_output=True)
            print(f"生成しました: {audio_path}")


def write_material_files(materials: list[dict], output_dir: Path, audio_dir_name: str, audio_extension: str) -> None:
    """教材JSONと一覧JSONを静的配信用ディレクトリへ配置する。"""
    output_dir.mkdir(parents=True, exist_ok=True)
    index = []
    for material in materials:
        material_path = output_dir / f"{material['id']}.json"
        material_path.write_text(json.dumps(material, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        index.append({"id": material["id"], "title": material["title"], "path": f"{output_dir.name}/{material['id']}.json", "audio": f"{audio_dir_name}/{material['id']}.{audio_extension}"})
    (output_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"JSONを配置しました: {output_dir}（{len(materials)}件）")


def parse_args() -> argparse.Namespace:
    """コマンドライン引数を解析する。"""
    parser = argparse.ArgumentParser(description="教材JSONを検証し、Open JTalk音声を生成します。")
    parser.add_argument("input", type=Path, nargs="?", default=DEFAULT_INPUT_DIR, help="教材JSONまたは入力ディレクトリ（省略時: materials）")
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC_DIR, help="静的配信ルート（省略時: public）")
    parser.add_argument("--output-dir", type=Path, help="音声出力先（省略時: public/audio）")
    parser.add_argument("--open-jtalk", default="open_jtalk", help="open_jtalk実行ファイル")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="FFmpeg実行ファイル")
    parser.add_argument("--dictionary", type=Path, default=DEFAULT_DICTIONARY, help="Open JTalk辞書ディレクトリ")
    parser.add_argument("--voice", type=Path, default=DEFAULT_VOICE, help="HTS voiceファイル")
    parser.add_argument("--validate-only", action="store_true", help="検証だけ行い音声を生成しない")
    return parser.parse_args()


def main() -> int:
    """CLIを実行する。"""
    args = parse_args()
    try:
        if args.input.is_dir():
            materials = load_material_files(args.input)
        else:
            materials = load_materials(args.input)
        validate_materials(materials)
        print(f"教材JSONを検証しました: {len(materials)}件")
        public_dir = args.public_dir
        audio_dir = args.output_dir or public_dir / "audio"
        write_material_files(materials, public_dir / "materials", audio_dir.name, "ogg")
        if not args.validate_only:
            synthesize_materials(materials, audio_dir, args.open_jtalk, args.ffmpeg, args.dictionary, args.voice)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"エラー: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
