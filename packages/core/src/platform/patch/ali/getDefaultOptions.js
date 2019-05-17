import {
  comparer
} from 'mobx'

import MPXProxy from '../../../core/proxy'
import customeKey from '../../../core/customOptionKeys'
import mergeOptions from '../../../core/mergeOptions'

function transformApiForProxy (context, currentInject) {
  const rawSetData = context.setData.bind(context)
  if (Object.getOwnPropertyDescriptor(context, 'setData').configurable) {
    Object.defineProperty(context, 'setData', {
      get () {
        return this.$mpxProxy.setData.bind(this.$mpxProxy)
      },
      configurable: true
    })
  }
  Object.defineProperties(context, {
    __getInitialData: {
      get () {
        return () => {
          const props = context.props
          if (props) {
            Object.keys(props).forEach((key) => {
              if (!key.startsWith('$')) {
                Object.defineProperty(context.data, key, {
                  get () {
                    return props[key]
                  },
                  set (val) {
                    props[key] = val
                  },
                  enumerable: true
                })
              }
            })
          }
          return context.data
        }
      },
      configurable: false
    },
    __render: {
      get () {
        return rawSetData
      },
      configurable: false
    }
  })
  if (currentInject) {
    if (currentInject.render) {
      Object.defineProperties(context, {
        __injectedRender: {
          get () {
            return currentInject.render.bind(context)
          },
          configurable: false
        }
      })
    }
    if (currentInject.getRefsData) {
      Object.defineProperties(context, {
        __getRefsData: {
          get () {
            return currentInject.getRefsData
          },
          configurable: false
        }
      })
    }
  }
}

function filterOptions (options, type) {
  const newOptions = {}
  const ignoreProps = customeKey
  Object.keys(options).forEach(key => {
    if (ignoreProps.indexOf(key) !== -1 || (key === 'data' && typeof options[key] === 'function')) {
      return
    }
    if (key === 'properties' || key === 'props') {
      newOptions['props'] = Object.assign({}, options['properties'], options['props'])
    } else if (key === 'methods' && type === 'page') {
      Object.assign(newOptions, options[key])
    } else {
      newOptions[key] = options[key]
    }
  })
  return newOptions
}

export function getDefaultOptions (type, { rawOptions = {}, currentInject }) {
  const hookNames = type === 'component' ? ['onInit', 'didMount', 'didUnmount'] : ['onLoad', 'onReady', 'onUnload']
  const options = filterOptions(rawOptions, type)
  options.mixins = [{
    [hookNames[0]] () {
      // 提供代理对象需要的api
      transformApiForProxy(this, currentInject)
      // 缓存options
      this.$rawOptions = rawOptions
      // 创建proxy对象
      const mpxProxy = new MPXProxy(rawOptions, this)
      this.$mpxProxy = mpxProxy
      this.$mpxProxy.created()
    },
    didUpdate (prevProps) {
      if (prevProps && prevProps !== this.props) {
        Object.keys(prevProps).forEach(key => {
          if (!comparer.structural(this.props[key], prevProps[key])) {
            this[key] = this.props[key]
          }
        })
      }
      this.$mpxProxy.updated()
    },
    [hookNames[1]] () {
      this.$mpxProxy.mounted()
    },
    [hookNames[2]] () {
      this.$mpxProxy.destroyed()
    }
  }]
  return mergeOptions(options, type, false)
}
