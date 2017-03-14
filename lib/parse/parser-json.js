'use strict';

exports.extractHTTPPostMetrics = function(services, contentBuffer) {
	return services.parse.parseJSONContent(contentBuffer)
		.then((json) => {
			return services.parse.buildMetrics(json);
		});
};
