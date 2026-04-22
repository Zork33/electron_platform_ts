#!/usr/bin/env python3
"""
Скрипт для сдвига нумерации файлов миграций.

Использование:
    python3 renum.py <directory> <from_prefix> <up|down> [--step N] [--upper PREFIX] [--dry-run]

Аргументы:
    directory     - папка с миграциями (например main_db или analytic_db)
    from_prefix   - номер, начиная с которого сдвигать (например 000016)
    up|down       - направление: up = увеличить номера, down = уменьшить

Опции:
    --step N      - шаг сдвига (по умолчанию 1)
    --upper P     - верхняя граница (не включительно): файлы >= P не затрагиваются
    --dry-run     - показать что будет переименовано, не делая изменений

Примеры:
    # Вставить 2 свободных слота перед 000016 (сдвинуть 000016+ на +2)
    python3 renum.py main_db 000016 up --step 2

    # Закрыть пробел: сдвинуть 000018+ на -1
    python3 renum.py main_db 000018 down

    # Сдвинуть 000016–000019 на +1, не трогая файлы с нестандартными трапрефиксами (100020+)
    python3 renum.py main_db 000016 up --upper 100000

    # Предварительный просмотр без изменений
    python3 renum.py main_db 000016 up --step 2 --dry-run
"""

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def parse_prefix(name: str) -> tuple[int, int] | None:
    """
    Извлекает числовой префикс из имени файла.
    Возвращает (число, длина_префикса) или None если не подходит.
    """
    m = re.match(r'^(\d+)_', name)
    if not m:
        return None
    raw = m.group(1)
    return int(raw), len(raw)


def zero_pad(num: int, length: int) -> str:
    return str(num).zfill(length)


def rename_file(src: Path, dst: Path, dry_run: bool) -> None:
    if dry_run:
        return
    src.rename(dst)


def main():
    parser = argparse.ArgumentParser(
        description='Сдвиг нумерации файлов миграций',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('directory', help='Папка с миграциями (main_db, analytic_db)')
    parser.add_argument('from_prefix', help='Префикс, начиная с которого сдвигать (например 000016)')
    parser.add_argument('direction', choices=['up', 'down'], help='Направление сдвига')
    parser.add_argument('--step', type=int, default=1, help='Шаг сдвига (по умолчанию 1)')
    parser.add_argument('--upper', help='Верхняя граница (не включительно), например 100000')
    parser.add_argument('--dry-run', action='store_true', help='Только показать изменения, не переименовывать')

    args = parser.parse_args()

    migrations_dir = SCRIPT_DIR / args.directory
    if not migrations_dir.is_dir():
        print(f"❌ Директория не найдена: {migrations_dir}")
        sys.exit(1)

    # Парсим from_prefix
    from_str = args.from_prefix
    if not re.match(r'^\d+$', from_str):
        print(f"❌ Некорректный from_prefix: {from_str!r} (ожидаются только цифры)")
        sys.exit(1)
    from_num = int(from_str)
    prefix_len = len(from_str)

    # Парсим upper
    upper_num = None
    if args.upper:
        if not re.match(r'^\d+$', args.upper):
            print(f"❌ Некорректный --upper: {args.upper!r}")
            sys.exit(1)
        upper_num = int(args.upper)

    # Проверка шага
    if args.step <= 0:
        print(f"❌ Шаг должен быть положительным числом")
        sys.exit(1)

    # Проверка при direction=down: не уйдём ли в отрицательные числа
    if args.direction == 'down' and from_num - args.step < 0:
        print(f"❌ Сдвиг вниз на {args.step} от {from_num} даст отрицательный номер")
        sys.exit(1)

    # Собираем файлы, подходящие под критерии
    candidates = []
    for f in migrations_dir.iterdir():
        if not f.is_file():
            continue
        parsed = parse_prefix(f.name)
        if parsed is None:
            continue
        file_num, file_prefix_len = parsed

        # Файл должен иметь такую же длину префикса
        if file_prefix_len != prefix_len:
            continue

        # Файл должен быть >= from_num
        if file_num < from_num:
            continue

        # Файл должен быть < upper (если задано)
        if upper_num is not None and file_num >= upper_num:
            continue

        candidates.append((file_num, f.name))

    if not candidates:
        print("ℹ️  Файлы для переименования не найдены")
        sys.exit(0)

    # Формируем список переименований
    renames = []
    for file_num, name in candidates:
        new_num = file_num + args.step if args.direction == 'up' else file_num - args.step
        suffix = name[prefix_len:]  # всё после числового префикса (включая _)
        new_name = zero_pad(new_num, prefix_len) + suffix
        renames.append((name, new_name, file_num, new_num))

    # Проверка коллизий: целевые имена, которые уже существуют
    # и не входят в набор переименования (т.е. не будут освобождены)
    source_names = {old for old, new, _, _ in renames}
    target_names = {new for old, new, _, _ in renames}
    existing_names = {f.name for f in migrations_dir.iterdir() if f.is_file()}

    collisions = []
    for old_name, new_name, _, new_num in renames:
        if new_name in existing_names and new_name not in source_names:
            collisions.append((old_name, new_name))

    if collisions:
        print("❌ Обнаружены коллизии — целевые имена уже заняты файлами, не входящими в диапазон:")
        for old, new in collisions:
            print(f"  {old} -> {new}  ⚠️  {new} уже существует")
        print()
        print("Подсказка: используйте --upper чтобы ограничить диапазон,")
        print("или увеличьте шаг --step чтобы перепрыгнуть через существующие файлы.")
        sys.exit(1)

    # Сортировка: up — от больших к меньшим, чтобы не перезаписать соседний файл
    reverse = (args.direction == 'up')
    renames.sort(key=lambda x: x[2], reverse=reverse)

    # Вывод плана
    label = "🔍 Dry-run:" if args.dry_run else "📁"
    print(f"\n{label} сдвиг {'вперёд' if args.direction == 'up' else 'назад'} на {args.step}, "
          f"начиная с {from_str}" + (f", до {args.upper}" if args.upper else "") + "\n")

    for old_name, new_name, _, _ in renames:
        print(f"  {old_name}  →  {new_name}")

    print(f"\nВсего файлов: {len(renames)}")

    if args.dry_run:
        print("\n⚠️  Dry-run: изменения не применены. Уберите --dry-run для выполнения.")
        sys.exit(0)

    # Подтверждение
    print()
    answer = input("Применить? [y/N]: ").strip().lower()
    if answer not in ('y', 'yes', 'д', 'да'):
        print("Отменено.")
        sys.exit(0)

    # Выполняем переименования
    errors = []
    for old_name, new_name, _, _ in renames:
        src = migrations_dir / old_name
        dst = migrations_dir / new_name
        try:
            rename_file(src, dst, dry_run=False)
        except Exception as e:
            errors.append((old_name, new_name, str(e)))
            print(f"  ❌ {old_name} -> {new_name}: {e}")
        else:
            print(f"  ✅ {old_name} -> {new_name}")

    print()
    if errors:
        print(f"❌ Завершено с ошибками: {len(errors)} из {len(renames)} файлов не переименованы")
        sys.exit(1)
    else:
        print(f"✅ Готово! Переименовано файлов: {len(renames)}")


if __name__ == '__main__':
    main()
