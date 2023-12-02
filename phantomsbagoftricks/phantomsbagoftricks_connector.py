#!/usr/bin/python
# -*- coding: utf-8 -*-
# -----------------------------------------
# Phantom sample App Connector python file
# -----------------------------------------

# Python 3 Compatibility imports
from __future__ import print_function, unicode_literals

# Phantom App imports
import phantom.app as phantom
from phantom.base_connector import BaseConnector
from phantom.action_result import ActionResult

# Usage of the consts file is recommended
# from phantomssoarbagoftricks_consts import *
import requests
import json
from bs4 import BeautifulSoup


class RetVal(tuple):

    def __new__(cls, val1, val2=None):
        return tuple.__new__(RetVal, (val1, val2))


class PhantomsSoarBagOfTricksConnector(BaseConnector):

    def __init__(self):

        # Call the BaseConnectors init first
        super(PhantomsSoarBagOfTricksConnector, self).__init__()
        self._state = None


    def _handle_test_connectivity(self, param):
        action_result = self.add_action_result(ActionResult(dict(param)))        
        return action_result.set_status(phantom.APP_SUCCESS, 'Request succeeded')

    def _perform_action(self, param, action_id):
        self.save_progress("In action handler for: {0}".format(self.get_action_identifier()))
        action_result = self.add_action_result(ActionResult(dict(param)))
        param.update(self.get_config())
        param['action_id'] = action_id

        for k,v in param.items():
            if isinstance(v, str):
                if v.startswith('[') or v.startswith('{'):
                    param[k] = json.loads(v)

        if 'html_content' in param:
            param['html_content'] = param['html_content'].replace('\\"', '"')
        if action_id == 'activate_artifact_overview' or action_id == 'deactivate_artifact_overview':
            param['view_name'] = "Artifact overview"

        action_result.add_data(param)

        action_result.update_summary({'num_data': 1})

        return action_result.set_status(phantom.APP_SUCCESS)

    def handle_action(self, param):
        ret_val = phantom.APP_SUCCESS

        # Get the action that we are supposed to execute for this App Run
        action_id = self.get_action_identifier()

        self.debug_print("action_id", self.get_action_identifier())
        
        supported_actions = [
            'activate_artifact_overview',
            'deactivate_artifact_overview',
            'add_view',
            'remove_view',
            'reload_view',
            'show_popup',
            'add_playbooks',
            'remove_playbooks'
        ]

        if action_id in supported_actions:
            ret_val = self._perform_action(param, action_id)

        if action_id == 'test_connectivity':
            ret_val = self._handle_test_connectivity(param)

        return ret_val

    def initialize(self):
        # Load the state in initialize, use it to store data
        # that needs to be accessed across actions
        self._state = self.load_state()
        return phantom.APP_SUCCESS

    def finalize(self):
        # Save the state, this data is saved across actions and app upgrades
        self.save_state(self._state)
        return phantom.APP_SUCCESS


def main():
    import argparse

    argparser = argparse.ArgumentParser()

    argparser.add_argument('input_test_json', help='Input Test JSON file')
    argparser.add_argument('-u', '--username', help='username', required=False)
    argparser.add_argument('-p', '--password', help='password', required=False)

    args = argparser.parse_args()
    session_id = None

    username = args.username
    password = args.password

    if username is not None and password is None:

        # User specified a username but not a password, so ask
        import getpass
        password = getpass.getpass("Password: ")

    if username and password:
        try:
            login_url = PhantomsSoarBagOfTricksConnector._get_phantom_base_url() + '/login'

            print("Accessing the Login page")
            r = requests.get(login_url, verify=False)
            csrftoken = r.cookies['csrftoken']

            data = dict()
            data['username'] = username
            data['password'] = password
            data['csrfmiddlewaretoken'] = csrftoken

            headers = dict()
            headers['Cookie'] = 'csrftoken=' + csrftoken
            headers['Referer'] = login_url

            print("Logging into Platform to get the session id")
            r2 = requests.post(login_url, verify=False, data=data, headers=headers)
            session_id = r2.cookies['sessionid']
        except Exception as e:
            print("Unable to get session id from the platform. Error: " + str(e))
            exit(1)

    with open(args.input_test_json) as f:
        in_json = f.read()
        in_json = json.loads(in_json)
        print(json.dumps(in_json, indent=4))

        connector = PhantomsSoarBagOfTricksConnector()
        connector.print_progress_message = True

        if session_id is not None:
            in_json['user_session_token'] = session_id
            connector._set_csrf_info(csrftoken, headers['Referer'])

        ret_val = connector._handle_action(json.dumps(in_json), None)
        print(json.dumps(json.loads(ret_val), indent=4))

    exit(0)


if __name__ == '__main__':
    main()
