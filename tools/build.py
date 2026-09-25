#!/usr/bin/env python3
"""Inline src/ into a single playable page.

Writes index.html (a complete document you can open or host anywhere) and
dist/fragment.html (the same page without <html>/<head>, for embedding hosts
that add their own document skeleton).
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def main():
    page = (read('shell.html')
            .replace('/*SIM*/', read('spa-data.js') + '\n' + read('sim.js'))
            .replace('/*GAME*/', read('game.js')))
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    with open(os.path.join(ROOT, 'dist', 'fragment.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    title_end = page.index('</title>') + len('</title>')
    doc = head + page[:title_end] + '\n</head>\n<body>\n' + page[title_end:] + '\n</body>\n</html>\n'
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'index.html: {len(doc) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
