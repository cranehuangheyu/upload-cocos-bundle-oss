const OSS = require('ali-oss');
const readdirp = require('readdirp');
const ProgressBar = require('progress');

// https://www.npmjs.com/package/ali-oss
const client = new OSS({
  region: '',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
});
const JSB_PATH = './build/jsb-link/remote';
const OSS_PATH = 'game/remote';

// 上面改成自己的配置

const remotes = [];
let errors = [];
const maxKeys = 1000;
let marker = null;
const list = async () => {
  do {
    const result = await client.list({
      marker,
      'max-keys': maxKeys,
    });
    marker = result.nextMarker;
    if (result.objects) {
      remotes.push(...result.objects.map(v => v.name));
    }
  } while (marker);
}
const upload = async (name, path) =>
  await new Promise(resolve => {
    // // 可以使用这里测试
    // if (Math.random() < 0.2) {
    //   errors.push({ name, path });
    // }
    // resolve();
    // return;
    client.put(name, path).then(result => {
      if (result) {
        resolve();
      } else {
        console.log('error', name, path);
        errors.push({ name, path });
      }
    });
  }).catch(() => {});

(async () => {
  const files = await readdirp.promise(JSB_PATH);
  await list();
  const targets = files
    .map(value => {
      const { path, fullPath } = value;
      const name = `${OSS_PATH}/${path}`;
      if (remotes.findIndex(p => p === name) !== -1) {
        return null;
      }
      return { name, path: fullPath };
    })
    .filter(v => !!v);
  // 输出
  console.table(targets, ['name']);
  console.log(`需要上传文件数：${targets.length}`);

  process.stdin.setEncoding('utf8');
  process.stdin.on('readable', async () => {
    const bar = new ProgressBar('[:bar]:percent', {
      width: 20,
      total: targets.length,
    });
    for await (const target of targets) {
      const { name, path } = target;
      await upload(name, path);
      bar.tick();
      if (bar.complete) {
        console.log('targets complete');
      }
    }
    while (errors.length > 0) {
      const errs = errors.slice();
      errors = [];
      const bar1 = new ProgressBar('[:bar]:percent', {
        width: 20,
        total: errs.length,
      });
      for await (const target of errs) {
        const { name, path } = target;
        await upload(name, path);
        bar1.tick();
        if (bar1.complete) {
          console.log(`errors [${errs.length}] complete`);
        }
      }
    }
  });
})();
