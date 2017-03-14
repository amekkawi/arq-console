resource "aws_api_gateway_rest_api" "API" {
  name = "${var.ResourcePrefix}API"
  description = "TODO"
}

resource "aws_api_gateway_resource" "APIReceiving" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  parent_id = "${aws_api_gateway_rest_api.API.root_resource_id}"
  path_part = "receiving"
}

resource "aws_api_gateway_resource" "APIReceivingProxy" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  parent_id = "${aws_api_gateway_resource.APIReceiving.id}"
  path_part = "{proxy+}"
}

resource "aws_api_gateway_method" "APIReceivingProxyOPTIONS" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "APIReceivingProxyOPTIONS" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyOPTIONS.http_method}"
  type = "MOCK"

  request_templates {
    "application/json" = "{\"statusCode\":200}"
  }
}

resource "aws_api_gateway_method" "APIReceivingProxyPOST" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "APIReceivingProxyPOST" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyPOST.http_method}"
  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = "arn:aws:apigateway:${data.aws_region.Current.id}:lambda:path/2015-03-31/functions/${aws_lambda_function.HTTPPostReceivingLambda.arn}/invocations"

  # Transforms the incoming XML request to JSON
  request_templates {
    "application/xml" = <<EOF
{
   "body" : $input.json('$')
}
EOF
  }
}

resource "aws_api_gateway_integration_response" "APIReceivingProxyOPTIONS" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyOPTIONS.http_method}"
  status_code = "${aws_api_gateway_method_response.APIReceivingProxyOPTIONS200.status_code}"

  response_parameters {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'"
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  response_templates {
    "application/json" = ""
  }
}

resource "aws_api_gateway_method_response" "APIReceivingProxyOPTIONS200" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyOPTIONS.http_method}"
  status_code = "200"

  response_parameters {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin" = true
  }

  response_models {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_method_response" "APIReceivingProxyPOST200" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyPOST.http_method}"
  status_code = "200"
}

resource "aws_api_gateway_integration_response" "APIReceivingProxyPOST" {
  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  resource_id = "${aws_api_gateway_resource.APIReceivingProxy.id}"
  http_method = "${aws_api_gateway_method.APIReceivingProxyPOST.http_method}"
  status_code = "${aws_api_gateway_method_response.APIReceivingProxyPOST200.status_code}"

  # Transforms the backend JSON response to XML
  response_templates {
    "application/xml" = <<EOF
#set($inputRoot = $input.path('$'))
<?xml version="1.0" encoding="UTF-8"?>
<message>
    $inputRoot.body
</message>
EOF
  }
}

resource "aws_api_gateway_deployment" "APIDeployment" {
  depends_on = [
    "aws_api_gateway_method.APIReceivingProxyPOST",
    "aws_api_gateway_method.APIReceivingProxyOPTIONS"
  ]

  rest_api_id = "${aws_api_gateway_rest_api.API.id}"
  stage_name = "prod"
  stage_description = "prod-${data.template_file.APIGatewayStageVersion.rendered}"
  description = "${data.template_file.APIGatewayStageVersion.rendered}"
}
