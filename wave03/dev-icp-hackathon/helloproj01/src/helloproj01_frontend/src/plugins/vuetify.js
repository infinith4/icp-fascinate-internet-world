import { createVuetify } from 'vuetify'

import 'vuetify/styles'  // 必須
import '@mdi/font/css/materialdesignicons.css' // 追加
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { fa } from 'vuetify/iconsets/fa'
import { aliases, mdi } from 'vuetify/iconsets/mdi' // MDIアイコンを使用
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure your 

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi, fa },
  },
})