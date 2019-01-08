const _ = require('lodash')

module.exports = {
  assignment(leftObject, rightObject, isDeepClone = false) {
    const tinyVlBlk = targetParam => targetParam === '' || targetParam === null || targetParam === undefined
    for (let rkey in rightObject) {
      // 当源的某个属性在目标中存在时，当且仅当源中的此值非空，则向目标赋值；不存在于目标的属性则直接插入源
      if (Object.hasOwnProperty.call(leftObject, rkey)) {
        if (!tinyVlBlk(rightObject[rkey])) {
          if (isDeepClone) {
            leftObject[rkey] = _.cloneDeep(rightObject[rkey])
          } else {
            leftObject[rkey] = rightObject[rkey]
          }
        }
      } else {
        if (isDeepClone) {
          leftObject[rkey] = _.cloneDeep(rightObject[rkey])
        } else {
          leftObject[rkey] = rightObject[rkey]
        }
      }
    }
    return leftObject
  },
  // 更保守的赋值
  conservativeAssignment(leftObject, rightObject, isDeepClone = false) {
    const tinyVlBlk = targetParam => targetParam === '' || targetParam === null || targetParam === undefined
    for (let rkey in rightObject) {
      // 仅当源的某个属性在目标中不存在时，才向目标赋此值
      if (!Object.hasOwnProperty.call(leftObject, rkey)) {
        if (isDeepClone) {
          leftObject[rkey] = _.cloneDeep(rightObject[rkey])
        } else {
          leftObject[rkey] = rightObject[rkey]
        } 
      }
    }
    return leftObject
  }
}