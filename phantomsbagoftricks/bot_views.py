import json

def display_bot(provides, all_app_runs, context):
    context['app_path'] = context['dark_title_logo'].split('/')[0]
    context['ctx'] = context.copy()
    context['app_config'] = {}

    for summary, action_results in all_app_runs:
        for result in action_results:
            for data in result.get_data():          
                context.update({
                    'param': result.get_param(),
                    'data': data,
                    'summary': result.get_summary()
                })
                context['app_config'].update({
                    'enable_button': data.get('enable_button', True),
                    'enable_sidebar': data.get('enable_sidebar', True),
                    'popup_duration': data.get('popup_duration', 15)
                })

    context['data']['app_run_id'] = context['ctx']['QS']['app_run'][0]
    context['app_config'] = json.dumps(context['app_config'])
                
    return 'bot_widget.html'