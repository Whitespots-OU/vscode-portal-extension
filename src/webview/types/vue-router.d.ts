import 'vue-router'

declare module 'vue-router' {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  VueRouter

  interface RouteMeta extends RouteMetaCustom {
    noAuth?: boolean
  }

  declare interface RouterLinkProps extends RouterLinkProps {
    to: RouteLocationCurrent
    replace?: boolean
  }

  declare interface NavigationGuard {
    (from: RouteLocationCurrentMatched, to: RouteLocationCurrentMatched, next: import('vue-router').NavigationGuardNext): import('vue-router').NavigationGuardReturn | Promise<import('vue-router').NavigationGuardReturn>
  }

  interface TypesConfig {
    $route: RouteLocationCurrentMatched & {
      redirectedFrom: RouteLocationCurrentMatched | undefined
    }

    $router: RouterWithParams
  }

  function useRouter(): RouterWithParams

  function useRoute<T extends RouteLocationCurrent['name']>(): GetRouteMatchedByName<T> & {
    redirectedFrom: RouteLocationCurrentMatched | undefined
  }
}

type ForParams<List, Result = NonNullable<unknown>> = List extends [infer Current, ...infer Tail]
  ? Current extends `:${ infer Param }?`
  ? ForParams<Tail, {
    [Key in Param | keyof Result]: Key extends keyof Result
    ? Result[Key]
    : Param extends `${ string }Id` ? number | string | undefined : string | undefined
  }>
  : Current extends `:${ infer Param }`
  ? ForParams<Tail, {
    [Key in Param | keyof Result]: Key extends keyof Result
    ? Result[Key]
    : Param extends `${ string }Id` ? number | string : string
  }>
  : ForParams<Tail, Result>
  : Result

type GetQueryType<Head> = Head['meta'] extends object
  ? Head['meta']['defaultQueryParams'] extends object
  ? EncodeQueryParams<Head['meta']['defaultQueryParams']>
  : NonNullable<unknown>
  : NonNullable<unknown>

type GetMetaType<Head> = Head['meta'] extends object
  ? {
    [Key in keyof RouteMetaCustom]: Key extends keyof Head['meta']
    ? Key extends 'actionsBarFilter' | 'actionsBarButtons' | 'headerTitleComponent' | 'headerSearchComponent' | 'navBarComponent'
    ? RouteMetaCustom[Key]
    : Head['meta'][Key]
    : RouteMetaCustom[Key]
  }
  : RouteMetaCustom

type GetRoute<FullPath, Head> = FullPath extends `${ string }:${ string }` ? {
  params: ForParams<Split<FullPath, '/'>>
  name: Head['name']
  query?: GetQueryType<Head>
  hash?: string
  meta?: GetMetaType<Head>
} : {
  name: Head['name']
  query?: GetQueryType<Head>
  hash?: string
  meta?: GetMetaType<Head>
}

type GetRouteMatched<FullPath, Head> = FullPath extends `${ string }:${ string }` ? {
  params: ForParams<Split<FullPath, '/'>>
  name: Head['name']
  query: GetQueryType<Head>
  hash: string
  meta: GetMetaType<Head>
  fullPath: string
  matched: import('vue-router').RouteRecord[]
} : {
  name: Head['name']
  query: GetQueryType<Head>
  hash: string
  meta: GetMetaType<Head>
  fullPath: string
  matched: import('vue-router').RouteRecord[]
}

type ProccessRoutes<T, IsMatched = false, Path extends string = ''> =
  T extends [infer Head, ...infer Tail]
  ? Head extends import('vue-router').RouteRecordRaw
  ? Head['name'] extends string
  ? [
    IsMatched extends true
    ? GetRouteMatched<`${ Path }/${ Head['path'] }`, Head>
    : GetRoute<`${ Path }/${ Head['path'] }`, Head>,
    ...ProccessRoutes<Head['children'], IsMatched, `${ Path }/${ Head['path'] }`>,
    ...ProccessRoutes<Tail, IsMatched, Path>
  ]
  : [
    ...ProccessRoutes<Head['children'], IsMatched, `${ Path }/${ Head['path'] }`>,
    ...ProccessRoutes<Tail, IsMatched, Path>,
  ]
  : ProccessRoutes<Tail, IsMatched, Path>
  : []

type RoutesProccessed = ProccessRoutes<typeof import('@popup/router/router').routes>
type RoutesProccessedMatched = ProccessRoutes<typeof import('@popup/router/router').routes, true>

declare type RouteLocationCurrent = RoutesProccessed[number]
declare type RouteLocationCurrentMatched = RoutesProccessedMatched[number]

type GetRouteByName<Name extends RouteLocationCurrent['name'], List = RoutesProccessed, Result = NonNullable<unknown>> = List extends [infer Head, ...infer Tail]
  ? Head['name'] extends Name
  ? GetRouteByName<Name, Tail, {
    [Key in keyof Head | keyof Result]: Key extends keyof Head
    ? Key extends keyof Result
    ? Key extends 'params' | 'query' | 'meta'
    ? {
      [Param in keyof Head[Key] | keyof Result[Key]]: Param extends keyof Head[Key]
      ? Param extends keyof Result[Key]
      ? Head[Key][Param] | Result[Key][Param]
      : Head[Key][Param]
      : Result[Key][Param]
    }
    : Head[Key] | Result[Key]
    : Head[Key]
    : Result[Key]
  }>
  : GetRouteByName<Name, Tail, Result>
  : Result

declare type GetRouteMatchedByName<Name extends RouteLocationCurrent['name']> = GetRouteByName<Name, RoutesProccessedMatched>
declare type GetRouteByName<Name extends RouteLocationCurrent['name']> = GetRouteByName<Name, RoutesProccessed>

type GetRoutesWithParams<Current> = Current extends [infer Head, ...infer Tail]
  ? Head['params'] extends object
  ? [Head, ...GetRoutesWithParams<Tail>]
  : GetRoutesWithParams<Tail>
  : []

type RoutesWithParams = GetRoutesWithParams<RoutesProccessed>

type Params = RoutesWithParams[number]['params']

type NamelessRoute = {
  query?: import('vue-router').LocationQueryRaw
  hash?: string
}

type RouterWithParams = {
  push(to: RouteLocationCurrent | NamelessRoute): ReturnType<import('vue-router').Router['push']>

  replace(to: RouteLocationCurrent | NamelessRoute): ReturnType<import('vue-router').Router['replace']>

  resolve<T extends string | RouteLocationCurrent | import('vue-router').RouteRecordRaw | import('vue-router').RouteRecordRedirectOption>(to: T, currentLocation?: RouteLocationCurrentMatched): T extends {name: infer Name} ? GetRouteMatchedByName<Name> : RouteLocationCurrentMatched

  back(): ReturnType<import('vue-router').Router['back']>
}

interface RouteMetaCustom {
  title?: string
}