"""Optional interoperability check using Python's standard ZIP reader."""
from pathlib import Path
from zipfile import ZipFile

with ZipFile(Path('test-output/interoperability.zip')) as archive:
    assert archive.testzip() is None
    assert archive.namelist() == ['Documents/अभ्यास.txt', 'empty.txt', 'binary.bin']
    assert archive.read('Documents/अभ्यास.txt').decode('utf-8') == 'नमस्ते\n'
    assert archive.read('empty.txt') == b''
    assert archive.read('binary.bin') == bytes([0, 255, 1, 128])
print('ZIP opened by Python zipfile: UTF-8 names, CRC and all contents verified.')
