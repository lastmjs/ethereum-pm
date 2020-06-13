window.process = {
    env: {
        NODE_ENV: window.location.hostname === 'ethereumpm.com' ? 'production' : window.location.hostname.includes('.netlify.app') ? 'staging' : 'development',
        testing: false
    },
    argv: []
};