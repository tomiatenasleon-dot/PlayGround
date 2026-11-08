#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
export PORT

/usr/bin/time -p npm install
/usr/bin/time -p mkdir -p "$PROJECT_DIR/dist"
/usr/bin/time -p cp index.html style.css game.js "$PROJECT_DIR/dist/"
/usr/bin/time -p node --input-type=module -e 'import { mkdir, writeFile } from "node:fs/promises"; const dir="/home/runner/work/_temp/omgithub-web"; await mkdir(dir,{recursive:true}); await writeFile(`${dir}/deployment-output.json`,JSON.stringify({project:"/home/runner/work/PlayGround/PlayGround",directory:"/home/runner/work/PlayGround/PlayGround/dist"},null,2)+"\n")'
cd "$PROJECT_DIR/dist"
exec /usr/bin/time -p node "$PROJECT_DIR/server.js"
