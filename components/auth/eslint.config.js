// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    rules: {
      'eslint-comments/no-unlimited-disable': 'off',
      'no-console': 'off',
      'ts/explicit-function-return-type': 'off',
    },
  },
)
