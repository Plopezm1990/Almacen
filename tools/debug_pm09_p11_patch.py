import subprocess
from pathlib import Path
r = subprocess.run(['python','tools/corregir_pm09_p11_iva.py'], text=True, capture_output=True)
Path('tests/pm09/P11_PATCH_DEBUG.txt').write_text(f'code={r.returncode}\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}\n', encoding='utf-8')
print('PM09_P11_DEBUG_CAPTURED=1')
