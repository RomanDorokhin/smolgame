const { spawn } = require('child_process');

const child = spawn('node', ['-v'], { shell: true });
child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));
child.on('close', c => console.log('CODE:', c));
