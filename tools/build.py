import glob, os
root = os.path.dirname(os.path.abspath(__file__)) + '/..'
js = '\n'.join(open(f).read() for f in sorted(glob.glob(root + '/src/0*.js')))
shell = open(root + '/src/shell.html').read().replace('/*__GAME__*/', js)
os.makedirs(root + '/dist', exist_ok=True)
open(root + '/dist/umbral-artifact.html', 'w').write(shell)
head, rest = shell.split('<style>', 1)
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '<style>' + rest.split('</style>', 1)[0] + '</style>\n</head>\n<body>\n' + rest.split('</style>', 1)[1] + '\n</body>\n</html>\n')
open(root + '/index.html', 'w').write(full)
print(len(full))
