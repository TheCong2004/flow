module.exports = {
    overrides: [
        {
            files: ['Agentflow.tsx'],
            rules: {
                // Generated media previews have no authored caption track.
                'jsx-a11y/media-has-caption': 'off'
            }
        }
    ]
}
