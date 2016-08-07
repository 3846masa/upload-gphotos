export default () => ({
  'protocolVersion': '0.8',
  'createSessionRequest': {
    'fields': [{
      'external': {
        'name': 'file',
        'filename': '',
        'put': {},
        'size': 0
      }
    }, {
      'inlined': {
        'name': 'auto_create_album',
        'content': 'camera_sync.active',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'auto_downsize',
        'content': 'true',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'storage_policy',
        'content': 'use_manual_setting',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'disable_asbe_notification',
        'content': 'true',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'client',
        'content': 'photosweb',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'effective_id',
        'content': '',
        'contentType': 'text/plain'
      }
    }, {
      'inlined': {
        'name': 'owner_name',
        'content': '',
        'contentType': 'text/plain'
      }
    }]
  }
});
