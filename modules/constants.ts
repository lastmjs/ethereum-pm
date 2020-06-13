export const origin = {
    'production': 'https://ethereumpm.com',
    'development': 'http://localhost:7010'
}[getEnvironment()];

export const ethereumNetwork = {
    'production': 'homestead',
    'development': 'ropsten'
}[getEnvironment()];

function getEnvironment() {
    if (window.location.hostname === 'ethereumpm.com') {
        return 'production';
    }
    else {
        return 'development';
    }
}