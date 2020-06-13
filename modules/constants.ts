export const origin = {
    'production': 'https://ethereumpm.netlify.app',
    'development': 'http://localhost:7010'
}[getEnvironment()];

export const ethereumNetwork = {
    'production': 'homestead',
    'development': 'ropsten'
}[getEnvironment()];

function getEnvironment() {
    if (window.location.hostname === 'ethereumpm.netlify.app') {
        return 'production';
    }
    else {
        return 'development';
    }
}