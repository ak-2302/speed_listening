#!/usr/bin/env python3
"""教材JSONの検証とOpen JTalk音声の一括生成を行う。"""

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


def load_materials(path: Path) -> list[dict]:
    """教材JSONを読み込む。"""
    with path.open(encoding="utf-8") as file:
        materials = json.load(file)
    if not isinstance(materials, list):
        raise ValueError("教材JSONのルートは配列にしてください。")
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


def synthesize_materials(materials: list[dict], output_dir: Path, open_jtalk: str, dictionary: Path, voice: Path) -> None:
    """Open JTalkで教材本文をWAVへ変換する。"""
    command = shutil.which(open_jtalk) or open_jtalk
    if shutil.which(command) is None and not Path(command).exists():
        raise FileNotFoundError(f"Open JTalkが見つかりません: {open_jtalk}")
    if not dictionary.is_dir():
        raise FileNotFoundError(f"辞書ディレクトリが見つかりません: {dictionary}")
    if not voice.is_file():
        raise FileNotFoundError(f"音声ファイルが見つかりません: {voice}")
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary_dir:
        text_dir = Path(temporary_dir)
        for material in materials:
            text_path = text_dir / f"{material['id']}.txt"
            audio_path = output_dir / f"{material['id']}.wav"
            text_path.write_text(material["body"], encoding="utf-8")
            subprocess.run(
                [command, "-x", str(dictionary), "-m", str(voice), "-ow", str(audio_path), str(text_path)],
                check=True,
            )
            print(f"生成しました: {audio_path}")


def parse_args() -> argparse.Namespace:
    """コマンドライン引数を解析する。"""
    parser = argparse.ArgumentParser(description="教材JSONを検証し、Open JTalk音声を生成します。")
    parser.add_argument("input", type=Path, help="教材JSONファイル")
    parser.add_argument("--output-dir", type=Path, help="WAV出力先")
    parser.add_argument("--open-jtalk", default="open_jtalk", help="open_jtalk実行ファイル")
    parser.add_argument("--dictionary", type=Path, help="Open JTalk辞書ディレクトリ")
    parser.add_argument("--voice", type=Path, help="HTS voiceファイル")
    parser.add_argument("--validate-only", action="store_true", help="検証だけ行い音声を生成しない")
    return parser.parse_args()


def main() -> int:
    """CLIを実行する。"""
    args = parse_args()
    try:
        materials = load_materials(args.input)
        validate_materials(materials)
        print(f"教材JSONを検証しました: {len(materials)}件")
        if not args.validate_only:
            if not args.output_dir or not args.dictionary or not args.voice:
                raise ValueError("音声生成には --output-dir、--dictionary、--voice が必要です。")
            synthesize_materials(materials, args.output_dir, args.open_jtalk, args.dictionary, args.voice)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"エラー: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
