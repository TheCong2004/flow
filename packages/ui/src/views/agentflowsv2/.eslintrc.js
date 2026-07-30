module.exports = {
    overrides: [
        {
            files: ['CanvasMediaNode.jsx'],
            rules: {
                // These labels describe grouped canvas settings rather than a
                // single form control.
                'jsx-a11y/label-has-associated-control': 'off'
            }
        }
    ]
}
